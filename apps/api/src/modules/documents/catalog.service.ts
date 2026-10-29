import { Injectable, NotFoundException } from '@nestjs/common';
import { withTenant, type Prisma } from '@brand-os/db';
import type { ClientInput, ProductInput } from '@brand-os/shared';
import type { TenantContext } from '../../common/request-context.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * US-62 : clients et produits réutilisables. La suppression n'affecte pas les
 * documents émis, qui gardent une copie du client (RG-31).
 */
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  listClients(tenant: TenantContext, search?: string) {
    return withTenant(this.prisma.client, tenant, (tx) =>
      tx.client.findMany({
        where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined,
        orderBy: { name: 'asc' },
        take: 200,
      }),
    );
  }

  createClient(tenant: TenantContext, input: ClientInput) {
    return withTenant(this.prisma.client, tenant, (tx) =>
      tx.client.create({ data: { organizationId: tenant.organizationId, ...nullable(input) } }),
    );
  }

  updateClient(tenant: TenantContext, id: string, input: ClientInput) {
    return withTenant(this.prisma.client, tenant, async (tx) => {
      await mustExist(tx.client.findUnique({ where: { id } }), 'Client introuvable.');
      return tx.client.update({ where: { id }, data: nullable(input) });
    });
  }

  deleteClient(tenant: TenantContext, id: string) {
    return withTenant(this.prisma.client, tenant, async (tx) => {
      await mustExist(tx.client.findUnique({ where: { id } }), 'Client introuvable.');
      await tx.client.delete({ where: { id } });
    });
  }

  async listProducts(tenant: TenantContext) {
    const products = await withTenant(this.prisma.client, tenant, (tx) => tx.product.findMany({ orderBy: { name: 'asc' }, take: 500 }));
    return products.map(productView);
  }

  async createProduct(tenant: TenantContext, input: ProductInput) {
    return productView(
      await withTenant(this.prisma.client, tenant, async (tx) => {
        const organization = await tx.organization.findUniqueOrThrow({ where: { id: tenant.organizationId }, select: { currency: true } });
        return tx.product.create({
          data: { organizationId: tenant.organizationId, currency: organization.currency, ...productData(input) },
        });
      }),
    );
  }

  async updateProduct(tenant: TenantContext, id: string, input: ProductInput) {
    return productView(
      await withTenant(this.prisma.client, tenant, async (tx) => {
        await mustExist(tx.product.findUnique({ where: { id } }), 'Produit introuvable.');
        return tx.product.update({ where: { id }, data: productData(input) });
      }),
    );
  }

  deleteProduct(tenant: TenantContext, id: string) {
    return withTenant(this.prisma.client, tenant, async (tx) => {
      await mustExist(tx.product.findUnique({ where: { id } }), 'Produit introuvable.');
      await tx.product.delete({ where: { id } });
    });
  }
}

async function mustExist<T>(query: Promise<T | null>, message: string): Promise<T> {
  const row = await query;
  if (!row) throw new NotFoundException(message);
  return row;
}

function nullable(input: ClientInput) {
  return { name: input.name, email: input.email ?? null, phone: input.phone ?? null, address: input.address ?? null, ifu: input.ifu ?? null };
}

function productData(input: ProductInput) {
  return {
    name: input.name,
    description: input.description ?? null,
    unit: input.unit ?? null,
    unitPriceMinor: BigInt(input.unitPriceMinor),
    vatRateBps: input.vatRateBps,
  };
}

function productView(p: Prisma.ProductGetPayload<object>) {
  return { ...p, unitPriceMinor: Number(p.unitPriceMinor) };
}
