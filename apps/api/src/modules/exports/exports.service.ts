import { InjectQueue } from '@nestjs/bullmq';
import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { withTenant, type Export } from '@brand-os/db';
import { businessCardCompositionSchema, can, type CreateExportInput } from '@brand-os/shared';
import type { Queue } from 'bullmq';
import type { AuthContext, TenantContext } from '../../common/request-context.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SIGNED_URL_TTL_SECONDS, StorageService } from '../storage/storage.service.js';
import { UsageService } from '../usage/usage.service.js';
import { loadBrandSnapshot } from './brand-snapshot.js';
import { loadDocumentInput } from './document-input.js';

export const EXPORTS_QUEUE = 'exports';

export interface ExportJob {
  exportId: string;
  organizationId: string;
}

@Injectable()
export class ExportsService {
  private readonly logger = new Logger(ExportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: UsageService,
    private readonly storage: StorageService,
    @InjectQueue(EXPORTS_QUEUE) private readonly queue: Queue<ExportJob>,
  ) {}

  /**
   * Demande d'export : contrôles (e-mail vérifié, offre, quota, marque complète),
   * puis traitement en tâche de fond (§7) pour ne jamais bloquer l'interface.
   */
  async create(tenant: TenantContext, auth: AuthContext, input: CreateExportInput) {
    // US-02 : l'adresse doit être vérifiée avant d'exporter.
    if (!auth.emailVerified) {
      throw new ForbiddenException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Confirmez votre adresse e-mail pour exporter vos créations.',
      });
    }

    const created = await withTenant(this.prisma.client, tenant, async (tx) => {
      // Facture, devis ou avoir : PDF du document émis, compté dans le quota de
      // documents (à l'émission), pas dans celui des exports haute définition.
      if (input.type === 'BUSINESS_DOCUMENT_PDF') {
        if (!can(tenant.role, 'document.create')) throw new ForbiddenException('Votre rôle ne permet pas d’accéder aux factures.');
        const document = await tx.businessDocument.findUnique({ where: { id: input.documentId }, select: { id: true, status: true } });
        if (!document) throw new NotFoundException('Document introuvable.');
        if (document.status === 'DRAFT') {
          throw new ConflictException({ code: 'DOCUMENT_DRAFT', message: 'Émettez d’abord le document pour le télécharger en PDF.' });
        }
        const { brandId } = await loadDocumentInput(tx, document.id);
        return tx.export.create({
          data: {
            organizationId: tenant.organizationId,
            brandId,
            documentId: document.id,
            type: input.type,
            brandVersion: 0,
            watermarked: false,
            includesVector: true,
            quotaCharged: false,
            createdById: tenant.userId,
          },
        });
      }

      let designId: string | null = null;
      let brandId: string;
      if (input.type === 'BUSINESS_CARD_PDF') {
        // RLS : une création d'une autre organisation est introuvable.
        const design = await tx.design.findUnique({ where: { id: input.designId } });
        if (!design || !businessCardCompositionSchema.safeParse(design.composition).success) {
          throw new NotFoundException('Carte de visite introuvable.');
        }
        designId = design.id;
        brandId = design.brandId;
      } else {
        brandId = input.brandId;
      }
      const brand = await loadBrandSnapshot(tx, brandId);
      const { quotas } = await this.usage.plan(tx, tenant.organizationId);
      if (input.type === 'GUIDELINES_PDF' && !quotas.svgAndGuidelines) {
        throw new HttpException(
          {
            code: 'PLAN_REQUIRED',
            message: 'La charte graphique PDF est disponible à partir de l’offre Starter.',
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
      await this.usage.assertAvailable(tx, tenant.organizationId, 'hdExportsPerMonth');

      const record = await tx.export.create({
        data: {
          organizationId: tenant.organizationId,
          brandId: brand.id,
          designId,
          type: input.type,
          brandVersion: brand.version,
          watermarked: quotas.watermarkedExports,
          includesVector: quotas.svgAndGuidelines,
          createdById: tenant.userId,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: tenant.userId,
          organizationId: tenant.organizationId,
          action: 'export.create',
          resourceType: 'Export',
          resourceId: record.id,
          metadata: { type: input.type, brandId: brand.id, ...(designId && { designId }) },
        },
      });
      return record;
    });

    try {
      await this.queue.add(
        'export',
        { exportId: created.id, organizationId: tenant.organizationId },
        {
          jobId: created.id,
          attempts: 2,
          backoff: { type: 'exponential', delay: 2_000 },
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 1000 },
        },
      );
    } catch (err) {
      this.logger.error(`Mise en file impossible pour l'export ${created.id} : ${(err as Error).message}`);
      await withTenant(this.prisma.client, tenant, (tx) =>
        tx.export.update({ where: { id: created.id }, data: { status: 'FAILED', quotaCharged: false, error: 'queue' } }),
      );
      throw new ServiceUnavailableException('Le service d’export est momentanément indisponible. Réessayez dans un instant.');
    }
    return this.view(created);
  }

  async get(tenant: TenantContext, exportId: string) {
    const record = await withTenant(this.prisma.client, tenant, (tx) => tx.export.findUnique({ where: { id: exportId } }));
    if (!record) throw new NotFoundException('Export introuvable.');
    return this.view(record);
  }

  async list(tenant: TenantContext) {
    const records = await withTenant(this.prisma.client, tenant, (tx) =>
      tx.export.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
    );
    return Promise.all(records.map((r) => this.view(r)));
  }

  async quota(tenant: TenantContext) {
    return withTenant(this.prisma.client, tenant, async (tx) => {
      const { plan, quotas } = await this.usage.plan(tx, tenant.organizationId);
      const status = await this.usage.status(tx, tenant.organizationId, 'hdExportsPerMonth');
      return { plan, ...status, watermarked: quotas.watermarkedExports, vector: quotas.svgAndGuidelines, guidelines: quotas.svgAndGuidelines };
    });
  }

  private async view(record: Export) {
    const ready = record.status === 'SUCCEEDED' && record.storageKey && record.fileName && record.mimeType;
    return {
      id: record.id,
      brandId: record.brandId,
      designId: record.designId,
      documentId: record.documentId,
      type: record.type,
      status: record.status,
      brandVersion: record.brandVersion,
      watermarked: record.watermarked,
      includesVector: record.includesVector,
      fileName: record.fileName,
      sizeBytes: record.sizeBytes === null ? null : Number(record.sizeBytes),
      failed: record.status === 'FAILED' || record.status === 'TIMED_OUT',
      createdAt: record.createdAt,
      completedAt: record.completedAt,
      // §9.1 : lien signé, valable 15 minutes, créé à chaque consultation
      download: ready
        ? {
            url: await this.storage.signedUrl(record.storageKey!, { fileName: record.fileName!, contentType: record.mimeType! }),
            expiresAt: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000),
          }
        : null,
    };
  }
}
