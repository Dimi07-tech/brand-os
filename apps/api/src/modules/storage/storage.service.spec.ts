import type { ConfigService } from '@nestjs/config';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { vi } from 'vitest';
import type { Env } from '../../config/env.js';
import { contentDisposition, LocalStorageService, StorageService } from './storage.service.js';

const ORG = '0192d3a4-1111-7000-8000-000000000001';
const EXP = '0192d3a4-2222-7000-8000-000000000002';
const KEY = `orgs/${ORG}/exports/${EXP}/chez-aicha-logos-v1.zip`;

let root: string;
let storage: LocalStorageService;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'brandos-storage-'));
  const values: Partial<Env> = { STORAGE_LOCAL_DIR: root, FILE_SIGNING_SECRET: 's'.repeat(40) };
  storage = new LocalStorageService({ get: (k: keyof Env) => values[k] } as unknown as ConfigService<Env, true>);
});

afterEach(async () => {
  vi.useRealTimers();
  await rm(root, { recursive: true, force: true });
});

const tokenOf = (url: string) => url.replace('/api/v1/files/', '');

describe('stockage local et liens signés (§9.1)', () => {
  it('stocke, signe et relit un fichier', async () => {
    await storage.put(KEY, new TextEncoder().encode('contenu'));
    const url = await storage.signedUrl(KEY, { fileName: 'Chez Aïcha.zip', contentType: 'application/zip' });
    const file = storage.verify(tokenOf(url));
    expect(file).toMatchObject({ key: KEY, fileName: 'Chez Aïcha.zip', contentType: 'application/zip' });
    expect((await storage.read(file.key)).toString()).toBe('contenu');
  });

  it('refuse un lien modifié', async () => {
    const token = tokenOf(await storage.signedUrl(KEY, { fileName: 'a.zip', contentType: 'application/zip' }));
    const [body, signature] = token.split('.') as [string, string];
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url').toString()), exp: 9e9 })).toString('base64url');
    expect(() => storage.verify(`${forged}.${signature}`)).toThrow('invalide');
    expect(() => storage.verify(`${body}.${signature.slice(0, -2)}xx`)).toThrow('invalide');
    expect(() => storage.verify('n-importe-quoi')).toThrow('invalide');
  });

  it('refuse un lien expiré après 15 minutes', async () => {
    vi.useFakeTimers();
    const token = tokenOf(await storage.signedUrl(KEY, { fileName: 'a.zip', contentType: 'application/zip' }));
    vi.advanceTimersByTime(14 * 60 * 1000);
    expect(() => storage.verify(token)).not.toThrow();
    vi.advanceTimersByTime(2 * 60 * 1000);
    expect(() => storage.verify(token)).toThrow('expiré');
  });

  it('refuse les clés hors format (traversée de répertoires)', async () => {
    for (const key of ['../../etc/passwd', `orgs/${ORG}/exports/${EXP}/../../secret`, `orgs/${ORG}/exports/${EXP}/.env`, '/etc/passwd']) {
      expect(() => StorageService.assertKey(key)).toThrow();
      await expect(storage.put(key, new Uint8Array())).rejects.toThrow();
    }
  });

  it('produit un en-tête de téléchargement sûr', () => {
    expect(contentDisposition('Chez Aïcha "v1".pdf')).toBe(
      `attachment; filename="Chez Aicha v1.pdf"; filename*=UTF-8''Chez%20A%C3%AFcha%20%22v1%22.pdf`,
    );
  });
});
