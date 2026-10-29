import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { withTenant, type Prisma } from '@brand-os/db';
import {
  createExportSchema,
  guidelinesTextSchema,
  type CreateExportInput,
  type GuidelinesText,
} from '@brand-os/shared';
import {
  CurrentAuth,
  CurrentTenant,
  RequirePermission,
  type AuthContext,
  type TenantContext,
} from '../../common/request-context.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TenantGuard } from '../organizations/tenant.guard.js';
import { loadBrandSnapshot } from './brand-snapshot.js';
import { loadDocumentInput } from './document-input.js';
import { ExportRunner } from './export-runner.js';
import { ExportsService } from './exports.service.js';

@ApiTags('exports')
@ApiHeader({ name: 'X-Organization-Id', required: true })
@Controller('exports')
@UseGuards(TenantGuard)
export class ExportsController {
  constructor(private readonly exports: ExportsService) {}

  /** Tous les membres peuvent récupérer les fichiers officiels de la marque (§1.2). */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission('brandKit.view')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(createExportSchema)) body: CreateExportInput,
  ) {
    return { export: await this.exports.create(tenant, auth, body) };
  }

  @Get()
  @RequirePermission('brandKit.view')
  async list(@CurrentTenant() tenant: TenantContext) {
    return { exports: await this.exports.list(tenant) };
  }

  @Get('quota')
  @RequirePermission('brandKit.view')
  async quota(@CurrentTenant() tenant: TenantContext) {
    return { quota: await this.exports.quota(tenant) };
  }

  @Get(':id')
  @RequirePermission('brandKit.view')
  async get(@CurrentTenant() tenant: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return { export: await this.exports.get(tenant, id) };
  }
}

/** Charte graphique — §4.5 : textes proposés, corrigés par l'utilisateur (US-41), aperçu. */
@ApiTags('brands')
@ApiHeader({ name: 'X-Organization-Id', required: true })
@Controller('brands/:id/guidelines')
@UseGuards(TenantGuard)
export class GuidelinesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runner: ExportRunner,
  ) {}

  @Get()
  @RequirePermission('brandKit.view')
  async get(@CurrentTenant() tenant: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    const brand = await withTenant(this.prisma.client, tenant, (tx) => loadBrandSnapshot(tx, id));
    return { texts: brand.texts, edited: brand.textsEdited, version: brand.version };
  }

  @Put()
  @RequirePermission('brand.edit')
  async save(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(guidelinesTextSchema)) texts: GuidelinesText,
  ) {
    await withTenant(this.prisma.client, tenant, async (tx) => {
      await loadBrandSnapshot(tx, id);
      await tx.brand.update({ where: { id }, data: { guidelines: texts as unknown as Prisma.InputJsonValue } });
      await tx.auditLog.create({
        data: {
          actorId: tenant.userId,
          organizationId: tenant.organizationId,
          action: 'brand.guidelines.save',
          resourceType: 'Brand',
          resourceId: id,
        },
      });
    });
    return { texts, edited: true };
  }

  /** Aperçu page par page (§5.3) : le même HTML que le PDF, affiché dans un cadre isolé. */
  @Get('preview')
  @RequirePermission('brandKit.view')
  async preview(@CurrentTenant() tenant: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    const brand = await withTenant(this.prisma.client, tenant, (tx) => loadBrandSnapshot(tx, id));
    return { html: this.runner.guidelinesHtml(brand) };
  }
}

/** Aperçu d'une facture, d'un devis ou d'un avoir : le même HTML que le PDF. */
@ApiTags('documents')
@ApiHeader({ name: 'X-Organization-Id', required: true })
@Controller('documents/:id/preview')
@UseGuards(TenantGuard)
@RequirePermission('document.create')
export class DocumentPreviewController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runner: ExportRunner,
  ) {}

  @Get()
  async preview(@CurrentTenant() tenant: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    const document = await withTenant(this.prisma.client, tenant, (tx) => loadDocumentInput(tx, id));
    return { html: this.runner.documentHtml(document) };
  }
}
