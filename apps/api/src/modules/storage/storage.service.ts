import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import type { Env } from '../../config/env.js';

/** Durée de validité des liens de téléchargement — §9.1 */
export const SIGNED_URL_TTL_SECONDS = 15 * 60;

/** Clés autorisées : orgs/<uuid>/<dossier>/<uuid>/<nom de fichier simple>. */
const KEY_PATTERN = /^orgs\/[0-9a-f-]{36}\/[a-z-]+\/[0-9a-f-]{36}\/[A-Za-z0-9][A-Za-z0-9._-]{0,150}$/;

export interface DownloadOptions {
  fileName: string;
  contentType: string;
}

/** Stockage objet des fichiers lourds (§7.1), hors de la base de données. */
export abstract class StorageService {
  abstract put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  abstract read(key: string): Promise<Buffer>;
  /** Lien de téléchargement valable 15 minutes. */
  abstract signedUrl(key: string, options: DownloadOptions): Promise<string>;

  static assertKey(key: string): void {
    if (!KEY_PATTERN.test(key)) throw new Error(`Clé de stockage invalide : ${key}`);
  }
}

interface LocalToken extends DownloadOptions {
  key: string;
  /** Expiration, en secondes depuis l'époque Unix */
  exp: number;
}

/**
 * Développement : fichiers sur disque. Les liens pointent vers l'API
 * (GET /api/v1/files/:token), signés par HMAC-SHA256, comme une URL présignée S3.
 */
@Injectable()
export class LocalStorageService extends StorageService {
  private readonly root: string;
  private readonly secret: string;

  constructor(config: ConfigService<Env, true>) {
    super();
    this.root = resolve(config.get('STORAGE_LOCAL_DIR', { infer: true }));
    this.secret = config.get('FILE_SIGNING_SECRET', { infer: true });
  }

  async put(key: string, body: Uint8Array): Promise<void> {
    const path = this.pathOf(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
  }

  read(key: string): Promise<Buffer> {
    return readFile(this.pathOf(key));
  }

  signedUrl(key: string, options: DownloadOptions): Promise<string> {
    StorageService.assertKey(key);
    const payload: LocalToken = { key, ...options, exp: Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return Promise.resolve(`/api/v1/files/${body}.${this.sign(body)}`);
  }

  /** Vérifie un jeton de téléchargement ; refuse toute altération ou expiration. */
  verify(token: string): LocalToken {
    const [body, signature] = token.split('.');
    if (!body || !signature) throw new ForbiddenException('Lien de téléchargement invalide.');
    const expected = Buffer.from(this.sign(body));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new ForbiddenException('Lien de téléchargement invalide.');
    }
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as LocalToken;
    if (payload.exp < Date.now() / 1000) {
      throw new ForbiddenException('Ce lien de téléchargement a expiré. Relancez le téléchargement depuis Brand OS.');
    }
    StorageService.assertKey(payload.key);
    return payload;
  }

  private sign(body: string): string {
    return createHmac('sha256', this.secret).update(body).digest('base64url');
  }

  private pathOf(key: string): string {
    StorageService.assertKey(key);
    const path = resolve(this.root, key);
    // Défense en profondeur contre la traversée de répertoires.
    if (!path.startsWith(this.root + sep)) throw new Error('Chemin hors du stockage');
    return path;
  }
}

/** Production : stockage objet compatible S3, chiffré au repos par le fournisseur (§9.1). */
@Injectable()
export class S3StorageService extends StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService<Env, true>) {
    super();
    const endpoint = config.get('S3_ENDPOINT', { infer: true });
    this.bucket = config.get('S3_BUCKET', { infer: true })!;
    this.client = new S3Client({
      region: config.get('S3_REGION', { infer: true }),
      endpoint,
      forcePathStyle: Boolean(endpoint),
      credentials: {
        accessKeyId: config.get('S3_ACCESS_KEY', { infer: true })!,
        secretAccessKey: config.get('S3_SECRET_KEY', { infer: true })!,
      },
    });
  }

  async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
    StorageService.assertKey(key);
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType, ServerSideEncryption: 'AES256' }),
    );
  }

  async read(key: string): Promise<Buffer> {
    StorageService.assertKey(key);
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return Buffer.from(await res.Body!.transformToByteArray());
  }

  signedUrl(key: string, options: DownloadOptions): Promise<string> {
    StorageService.assertKey(key);
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentType: options.contentType,
        ResponseContentDisposition: contentDisposition(options.fileName),
      }),
      { expiresIn: SIGNED_URL_TTL_SECONDS },
    );
  }
}

/** En-tête de téléchargement, avec nom de fichier ASCII et variante UTF-8 (RFC 6266). */
export function contentDisposition(fileName: string): string {
  const ascii = fileName.normalize('NFD').replace(/[^\x20-\x7e]/g, '').replace(/["\\]/g, '');
  return `attachment; filename="${ascii || 'fichier'}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
