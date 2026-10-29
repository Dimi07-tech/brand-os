import type { Prisma, PrismaClient } from './generated/prisma/client.js';

export type TenantTx = Prisma.TransactionClient;

export interface TenantContext {
  organizationId: string;
  userId?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Exécute `fn` dans une transaction soumise aux politiques RLS de l'organisation
 * (migration rls_tenant_isolation). Toute lecture ou écriture de données métier
 * doit passer par ici : une ligne d'une autre organisation est invisible, et
 * toute écriture pour une autre organisation est refusée par PostgreSQL.
 */
export async function withTenant<T>(
  prisma: PrismaClient,
  ctx: TenantContext,
  fn: (tx: TenantTx) => Promise<T>,
  options?: { isolationLevel?: Prisma.TransactionIsolationLevel; timeout?: number },
): Promise<T> {
  assertUuid(ctx.organizationId);
  if (ctx.userId !== undefined) assertUuid(ctx.userId);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL ROLE brandos_app`;
    await tx.$executeRaw`SELECT set_config('app.org_id', ${ctx.organizationId}, true),
                                set_config('app.user_id', ${ctx.userId ?? ''}, true)`;
    return fn(tx);
  }, options);
}

/**
 * Variante sans organisation active : seules les adhésions de l'utilisateur
 * sont visibles (pour lister « mes organisations »).
 */
export async function withUser<T>(
  prisma: PrismaClient,
  userId: string,
  fn: (tx: TenantTx) => Promise<T>,
): Promise<T> {
  assertUuid(userId);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL ROLE brandos_app`;
    await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
    return fn(tx);
  });
}

function assertUuid(value: string): void {
  if (!UUID.test(value)) throw new Error('Identifiant invalide');
}
