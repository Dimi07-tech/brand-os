import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { withTenant, type Export, type TenantTx } from '@brand-os/db';
import { businessCardCompositionSchema, type BusinessCardComposition } from '@brand-os/shared';
import type { Env } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { StorageService } from '../storage/storage.service.js';
import { loadBrandSnapshot, slugify, type BrandSnapshot } from './brand-snapshot.js';
import { CARD_PAGE, renderCardDocument } from './card-document.js';
import { loadDocumentInput } from './document-input.js';
import { DOCUMENT_FONTS, documentFooter, renderDocumentHtml, type DocumentInput } from './document-template.js';
import { FontLibrary } from './font-library.js';
import { renderGuidelinesHtml } from './guidelines-template.js';
import { buildLogoPack } from './logo-pack.js';
import { PdfRenderer } from './pdf-renderer.js';
import { PrintPdfService } from './print-pdf.js';

/** Délai maximal d'un export (la charte doit sortir en moins de 30 s, §10). */
const EXPORT_TIMEOUT_MS = 60_000;

type ExportSource =
  | { kind: 'brand'; brand: BrandSnapshot; card: BusinessCardComposition | null }
  | { kind: 'document'; document: DocumentInput };

interface BuiltFile {
  fileName: string;
  mimeType: string;
  body: Uint8Array;
}

/** Exécute un export en tâche de fond : construit le fichier, le stocke, met à jour son statut. */
@Injectable()
export class ExportRunner {
  private readonly logger = new Logger(ExportRunner.name);
  private readonly webOrigin: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly fonts: FontLibrary,
    private readonly pdf: PdfRenderer,
    private readonly print: PrintPdfService,
    private readonly mail: MailService,
    config: ConfigService<Env, true>,
  ) {
    this.webOrigin = config.get('WEB_ORIGIN', { infer: true });
  }

  async run(exportId: string, organizationId: string): Promise<void> {
    const tenant = { organizationId };
    const started = Date.now();
    const { record, source } = await withTenant(this.prisma.client, tenant, async (tx) => {
      const record = await tx.export.update({
        where: { id: exportId },
        data: { status: 'RUNNING', startedAt: new Date() },
      });
      return { record, source: await this.load(tx, record) };
    });

    const file = await withTimeout(this.build(record, source), EXPORT_TIMEOUT_MS);
    const key = `orgs/${organizationId}/exports/${exportId}/${file.fileName}`;
    await this.storage.put(key, file.body, file.mimeType);

    await withTenant(this.prisma.client, tenant, (tx) =>
      tx.export.update({
        where: { id: exportId },
        data: {
          status: 'SUCCEEDED',
          storageKey: key,
          fileName: file.fileName,
          mimeType: file.mimeType,
          sizeBytes: file.body.length,
          completedAt: new Date(),
          error: null,
        },
      }),
    );
    this.logger.log(`Export ${exportId} (${record.type}) terminé en ${Date.now() - started} ms, ${file.body.length} octets`);
    if (record.type === 'GUIDELINES_PDF' && source.kind === 'brand') await this.notify(record, source.brand);
  }

  /** Après le dernier essai : l'export échoue et ne compte pas dans le quota. */
  async markFailed(exportId: string, organizationId: string, error: Error): Promise<void> {
    this.logger.error(`Export ${exportId} en échec : ${error.message}`, error.stack);
    await withTenant(this.prisma.client, { organizationId }, (tx) =>
      tx.export.update({
        where: { id: exportId },
        data: {
          status: error instanceof TimeoutError ? 'TIMED_OUT' : 'FAILED',
          quotaCharged: false,
          error: error.message.slice(0, 500),
          completedAt: new Date(),
        },
      }),
    );
  }

  /** Données sources de l'export : document (facture, devis, avoir) ou marque (+ carte). */
  private async load(tx: TenantTx, record: Export): Promise<ExportSource> {
    if (record.type === 'BUSINESS_DOCUMENT_PDF') {
      if (!record.documentId) throw new Error('Document supprimé avant l’export');
      return { kind: 'document', document: await loadDocumentInput(tx, record.documentId) };
    }
    if (!record.brandId) throw new Error('Marque absente');
    const design = record.designId ? await tx.design.findUnique({ where: { id: record.designId } }) : null;
    return {
      kind: 'brand',
      brand: await loadBrandSnapshot(tx, record.brandId),
      card: design ? businessCardCompositionSchema.parse(design.composition) : null,
    };
  }

  private async build(record: Export, source: ExportSource): Promise<BuiltFile> {
    if (source.kind === 'document') {
      const { document } = source;
      // §4.8, RG-64 ; PDF de moins de 5 secondes (§10).
      return {
        fileName: `${document.number ?? 'brouillon'}-${slugify(document.issuer.name)}.pdf`,
        mimeType: 'application/pdf',
        body: await this.pdf.render(this.documentHtml(document), 'A4', documentFooter(document.issuer)),
      };
    }
    const { brand, card } = source;
    const slug = slugify(brand.name);
    if (record.type === 'BUSINESS_CARD_PDF') {
      if (!card) throw new Error('Carte de visite supprimée avant l’export');
      // US-53, RG-50 : recto et verso, fond perdu, texte vectorisé, puis CMJN.
      const html = renderCardDocument(
        { ...card, logo: brand.logo, colors: brand.colors, typography: brand.typography },
        this.fonts.engine,
        record.watermarked,
      );
      return {
        fileName: `${slug}-carte-de-visite-${slugify(card.fields.fullName)}.pdf`,
        mimeType: 'application/pdf',
        body: await this.print.toPrintReady(await this.pdf.render(html, CARD_PAGE)),
      };
    }
    if (record.type === 'LOGO_PACK') {
      return {
        fileName: `${slug}-logos-v${brand.version}.zip`,
        mimeType: 'application/zip',
        body: buildLogoPack(
          {
            slug,
            name: brand.name,
            logo: brand.logo,
            colors: brand.colors,
            version: brand.version,
            includesVector: record.includesVector,
            watermarked: record.watermarked,
          },
          this.fonts.engine,
        ),
      };
    }
    return {
      fileName: `${slug}-charte-graphique-v${brand.version}.pdf`,
      mimeType: 'application/pdf',
      body: await this.pdf.render(this.guidelinesHtml(brand)),
    };
  }

  documentHtml(document: DocumentInput): string {
    return renderDocumentHtml(document, this.fonts.engine, this.fonts.fontFaceCss(DOCUMENT_FONTS(document.brand)));
  }

  guidelinesHtml(brand: BrandSnapshot): string {
    return renderGuidelinesHtml(
      { ...brand, date: new Date() },
      this.fonts.engine,
      this.fonts.fontFaceCss([...new Set([brand.typography.heading, brand.typography.body])]),
    );
  }

  /** §4.11 : e-mail « export terminé » pour la charte, générée en tâche de fond. */
  private async notify(record: Export, brand: BrandSnapshot): Promise<void> {
    if (!record.createdById) return;
    const user = await this.prisma.client.user.findUnique({
      where: { id: record.createdById },
      select: { email: true, name: true },
    });
    if (!user) return;
    const link = `${this.webOrigin}/ma-marque/charte`;
    await this.mail.send({
      to: user.email,
      subject: `Votre charte graphique ${brand.name} est prête`,
      text: `Bonjour ${user.name},\n\nLa charte graphique de ${brand.name} (version ${brand.version}) est prête. Téléchargez-la depuis Brand OS :\n${link}`,
      html: `<p>Bonjour ${escape(user.name)},</p><p>La charte graphique de ${escape(brand.name)} (version ${brand.version}) est prête. <a href="${link}">Téléchargez-la depuis Brand OS</a>.</p>`,
    });
  }
}

class TimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new TimeoutError(`Délai de ${ms / 1000} s dépassé`)), ms);
    }),
  ]);
}

function escape(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
