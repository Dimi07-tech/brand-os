import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, withTenant, type TenantTx } from '@brand-os/db';
import {
  brandBriefSchema,
  completePalette,
  composeLogoProposals,
  generatePalettes,
  generationSeed,
  type BrandBrief,
  type BrandIdentityInput,
  type Palette,
} from '@brand-os/shared';
import type { TenantContext } from '../../common/request-context.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreativeDirector } from '../ai/creative-director.js';
import { UsageService } from '../usage/usage.service.js';

const brandInclude = {
  palettes: { where: { isActive: true }, take: 1 },
  typographies: { where: { isActive: true }, take: 1 },
} satisfies Prisma.BrandInclude;

type BrandWithIdentity = Prisma.BrandGetPayload<{ include: typeof brandInclude }>;

@Injectable()
export class BrandsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly director: CreativeDirector,
    private readonly usage: UsageService,
  ) {}

  private tx<T>(tenant: TenantContext, fn: (tx: TenantTx) => Promise<T>, options?: { timeout?: number }): Promise<T> {
    return withTenant(this.prisma.client, tenant, fn, options);
  }

  async list(tenant: TenantContext) {
    const brands = await this.tx(tenant, (tx) =>
      tx.brand.findMany({ include: brandInclude, orderBy: { createdAt: 'asc' } }),
    );
    return brands.map(toBrandView);
  }

  async get(tenant: TenantContext, brandId: string) {
    return toBrandView(await this.tx(tenant, (tx) => this.find(tx, brandId)));
  }

  /** US-20 : la marque naît du questionnaire créatif. */
  async create(tenant: TenantContext, brief: BrandBrief) {
    return this.tx(tenant, async (tx) => {
      await this.usage.assertAvailable(tx, tenant.organizationId, 'brands');
      const brand = await tx.brand.create({
        data: {
          organizationId: tenant.organizationId,
          name: brief.name,
          slogan: brief.slogan,
          values: brief.values,
          brief,
        },
        include: brandInclude,
      });
      await this.audit(tx, tenant, 'brand.create', brand.id);
      return toBrandView(brand);
    });
  }

  async updateBrief(tenant: TenantContext, brandId: string, brief: BrandBrief) {
    return this.tx(tenant, async (tx) => {
      await this.find(tx, brandId);
      const brand = await tx.brand.update({
        where: { id: brandId },
        data: { brief, values: brief.values, ...(brief.slogan !== undefined && { slogan: brief.slogan }) },
        include: brandInclude,
      });
      return toBrandView(brand);
    });
  }

  /**
   * US-21 : 6 propositions de logos et 3 palettes. Chaque série compte dans le
   * quota de générations IA (§6.2) ; un échec ne le consomme pas (§8.5).
   */
  async generate(tenant: TenantContext, brandId: string, attempt: number) {
    return this.tx(
      tenant,
      async (tx) => {
        const brief = briefOf(await this.find(tx, brandId));
        await this.usage.assertAvailable(tx, tenant.organizationId, 'aiGenerationsPerMonth');

        const seed = generationSeed(brief, attempt);
        const started = Date.now();
        const analysis = await this.director.analyze(brief, seed);
        const palettes = generatePalettes(brief, seed);
        const proposals = composeLogoProposals(brief, analysis.creative, palettes, seed);

        const generation = await tx.aIGeneration.create({
          data: {
            organizationId: tenant.organizationId,
            brandId,
            type: 'LOGO',
            provider: analysis.provider,
            model: analysis.model,
            status: 'SUCCEEDED',
            output: { attempt, creative: analysis.creative, proposals } as unknown as Prisma.InputJsonValue,
            costMicroXof: analysis.costMicroXof,
            durationMs: Date.now() - started,
            quotaCharged: true,
          },
        });
        const quota = await this.usage.status(tx, tenant.organizationId, 'aiGenerationsPerMonth');
        return { generationId: generation.id, attempt, creative: analysis.creative, palettes, proposals, quota };
      },
      { timeout: 30_000 },
    );
  }

  /** US-25 : 3 nouvelles palettes, sans consommer de quota (calcul local, sans IA). */
  async generatePalettes(tenant: TenantContext, brandId: string, attempt: number): Promise<Palette[]> {
    const brief = briefOf(await this.tx(tenant, (tx) => this.find(tx, brandId)));
    return generatePalettes(brief, generationSeed(brief, attempt) ^ 0xa5a5a5a5);
  }

  /**
   * US-22, US-25, US-26 : enregistre l'identité retenue dans le Brand Kit et
   * en garde un instantané versionné (BrandVersion).
   */
  async saveIdentity(tenant: TenantContext, brandId: string, input: BrandIdentityInput) {
    return this.tx(tenant, async (tx) => {
      const current = await this.find(tx, brandId);
      const palette = completePalette(input.palette);
      const version = current.activeVersionNum + 1;

      await tx.colorPalette.updateMany({ where: { brandId, isActive: true }, data: { isActive: false } });
      await tx.typography.updateMany({ where: { brandId, isActive: true }, data: { isActive: false } });
      await tx.colorPalette.create({
        data: {
          organizationId: tenant.organizationId,
          brandId,
          name: `Version ${version}`,
          isActive: true,
          colors: palette.colors as unknown as Prisma.InputJsonValue,
        },
      });
      await tx.typography.create({
        data: {
          organizationId: tenant.organizationId,
          brandId,
          headingFont: input.typography.heading,
          bodyFont: input.typography.body,
          isActive: true,
        },
      });
      const brand = await tx.brand.update({
        where: { id: brandId },
        data: {
          logo: input.logo,
          name: input.logo.name,
          slogan: input.logo.slogan ?? null,
          activeVersionNum: version,
        },
        include: brandInclude,
      });
      await tx.brandVersion.create({
        data: {
          organizationId: tenant.organizationId,
          brandId,
          number: version,
          snapshot: { logo: input.logo, palette, typography: input.typography } as unknown as Prisma.InputJsonValue,
          createdById: tenant.userId,
        },
      });
      await this.audit(tx, tenant, 'brand.identity.save', brandId, { version });
      return toBrandView(brand);
    });
  }

  private async find(tx: TenantTx, brandId: string): Promise<BrandWithIdentity> {
    // RLS : une marque d'une autre organisation est introuvable.
    const brand = await tx.brand.findUnique({ where: { id: brandId }, include: brandInclude });
    if (!brand) throw new NotFoundException('Marque introuvable.');
    return brand;
  }

  private async audit(
    tx: TenantTx,
    tenant: TenantContext,
    action: string,
    brandId: string,
    metadata: Prisma.InputJsonObject = {},
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorId: tenant.userId,
        organizationId: tenant.organizationId,
        action,
        resourceType: 'Brand',
        resourceId: brandId,
        metadata,
      },
    });
  }
}

function briefOf(brand: BrandWithIdentity): BrandBrief {
  return brandBriefSchema.parse(brand.brief);
}

function toBrandView(brand: BrandWithIdentity) {
  const palette = brand.palettes[0];
  const typography = brand.typographies[0];
  return {
    id: brand.id,
    name: brand.name,
    slogan: brand.slogan,
    brief: brand.brief,
    logo: brand.logo,
    version: brand.activeVersionNum,
    palette: palette ? { colors: palette.colors } : null,
    typography: typography ? { heading: typography.headingFont, body: typography.bodyFont } : null,
    createdAt: brand.createdAt,
    updatedAt: brand.updatedAt,
  };
}
