import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { withTenant, type Design, type Prisma } from '@brand-os/db';
import { logoSpecSchema, type CreateDesignInput, type UpdateDesignInput } from '@brand-os/shared';
import type { TenantContext } from '../../common/request-context.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/** Créations aux couleurs de la marque — §4.6, §4.7 (cartes de visite). */
@Injectable()
export class DesignsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenant: TenantContext) {
    const designs = await withTenant(this.prisma.client, tenant, (tx) =>
      tx.design.findMany({ orderBy: { updatedAt: 'desc' }, take: 50 }),
    );
    return designs.map(toView);
  }

  async get(tenant: TenantContext, id: string) {
    return toView(await withTenant(this.prisma.client, tenant, (tx) => find(tx, id)));
  }

  async create(tenant: TenantContext, input: CreateDesignInput) {
    return withTenant(this.prisma.client, tenant, async (tx) => {
      // RLS : une marque d'une autre organisation est introuvable.
      const brand = await tx.brand.findUnique({ where: { id: input.brandId }, select: { id: true, logo: true } });
      if (!brand) throw new NotFoundException('Marque introuvable.');
      if (!logoSpecSchema.safeParse(brand.logo).success) {
        throw new ConflictException({
          code: 'BRAND_INCOMPLETE',
          message: 'Enregistrez d’abord votre marque (logo, couleurs et polices) dans le Brand Studio.',
        });
      }
      const design = await tx.design.create({
        data: {
          organizationId: tenant.organizationId,
          brandId: brand.id,
          name: input.name ?? `Carte de visite · ${input.composition.fields.fullName}`,
          schemaVersion: input.composition.schemaVersion,
          composition: input.composition as unknown as Prisma.InputJsonValue,
          createdById: tenant.userId,
        },
      });
      await audit(tx, tenant, 'design.create', design.id);
      return toView(design);
    });
  }

  /**
   * RG-40 : mise à jour seulement si le client part de la dernière version ;
   * sinon 409 avec la version actuelle, pour que l'utilisateur choisisse.
   */
  async update(tenant: TenantContext, id: string, input: UpdateDesignInput) {
    return withTenant(this.prisma.client, tenant, async (tx) => {
      const { count } = await tx.design.updateMany({
        where: { id, version: input.version },
        data: {
          composition: input.composition as unknown as Prisma.InputJsonValue,
          schemaVersion: input.composition.schemaVersion,
          ...(input.name && { name: input.name }),
          version: { increment: 1 },
        },
      });
      const current = await find(tx, id);
      if (count === 0) {
        throw new ConflictException({
          code: 'VERSION_CONFLICT',
          message: 'Cette carte a été modifiée ailleurs (autre onglet ou autre appareil).',
          current: toView(current),
        });
      }
      return toView(current);
    });
  }

  async remove(tenant: TenantContext, id: string): Promise<void> {
    await withTenant(this.prisma.client, tenant, async (tx) => {
      await find(tx, id);
      await tx.design.delete({ where: { id } });
      await audit(tx, tenant, 'design.delete', id);
    });
  }
}

async function find(tx: Prisma.TransactionClient, id: string): Promise<Design> {
  const design = await tx.design.findUnique({ where: { id } });
  if (!design) throw new NotFoundException('Création introuvable.');
  return design;
}

async function audit(tx: Prisma.TransactionClient, tenant: TenantContext, action: string, id: string): Promise<void> {
  await tx.auditLog.create({
    data: { actorId: tenant.userId, organizationId: tenant.organizationId, action, resourceType: 'Design', resourceId: id },
  });
}

function toView(design: Design) {
  return {
    id: design.id,
    brandId: design.brandId,
    name: design.name,
    composition: design.composition,
    version: design.version,
    createdAt: design.createdAt,
    updatedAt: design.updatedAt,
  };
}
