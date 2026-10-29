import { ConflictException, Injectable } from '@nestjs/common';
import { withTenant, withUser } from '@brand-os/db';
import type { CreateOrganizationInput, UpdateOrganizationInput } from '@brand-os/shared';
import type { TenantContext } from '../../common/request-context.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * US-10 : crée l'entreprise, son Propriétaire (RG-11) et l'offre Gratuite.
   * Exécuté sous le rôle propriétaire : l'organisation n'existe pas encore.
   */
  async create(userId: string, input: CreateOrganizationInput) {
    return this.prisma.client.$transaction(async (tx) => {
      // MVP : une organisation par compte (§3.1). Verrou sur l'utilisateur
      // pour qu'une double soumission ne crée pas deux organisations.
      await tx.$queryRaw`SELECT 1 FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      const existing = await tx.membership.count({ where: { userId, status: 'ACTIVE' } });
      if (existing > 0) {
        throw new ConflictException('Votre compte est déjà rattaché à une entreprise.');
      }

      const organization = await tx.organization.create({
        data: {
          ...input,
          memberships: { create: { userId, role: 'OWNER' } },
          subscription: { create: { plan: 'FREE' } },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          organizationId: organization.id,
          action: 'organization.create',
          resourceType: 'Organization',
          resourceId: organization.id,
        },
      });
      return organization;
    });
  }

  /** Organisations dont l'utilisateur est membre actif, avec son rôle. */
  async listMine(userId: string) {
    const memberships = await withUser(this.prisma.client, userId, (tx) =>
      tx.membership.findMany({
        where: { userId, status: 'ACTIVE' },
        select: { role: true, organization: true },
        orderBy: { createdAt: 'asc' },
      }),
    );
    return memberships.map(({ role, organization }) => ({ ...organization, role }));
  }

  async get(tenant: TenantContext) {
    const organization = await withTenant(this.prisma.client, tenant, (tx) =>
      tx.organization.findUniqueOrThrow({ where: { id: tenant.organizationId } }),
    );
    return { ...organization, role: tenant.role };
  }

  // US-10, US-11
  async update(tenant: TenantContext, input: UpdateOrganizationInput) {
    const organization = await withTenant(this.prisma.client, tenant, async (tx) => {
      const updated = await tx.organization.update({
        where: { id: tenant.organizationId },
        data: input,
      });
      await tx.auditLog.create({
        data: {
          actorId: tenant.userId,
          organizationId: tenant.organizationId,
          action: 'organization.update',
          resourceType: 'Organization',
          resourceId: tenant.organizationId,
          metadata: { fields: Object.keys(input) },
        },
      });
      return updated;
    });
    return { ...organization, role: tenant.role };
  }
}
