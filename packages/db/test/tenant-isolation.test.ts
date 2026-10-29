// Tests d'isolation entre organisations (§9, §12.1) : aucune tentative d'accès
// croisé ne doit réussir. Critère de recette du MVP (§12.2).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, withTenant, withUser } from '../src/index.js';

const prisma = createPrismaClient(process.env.DATABASE_URL!);
const tag = `isolation-${Date.now()}`;

let orgA: string;
let orgB: string;
let userA: string;
let brandA: string;
let brandB: string;

beforeAll(async () => {
  // Jeu de données créé sous le rôle propriétaire (hors RLS).
  const [a, b] = await Promise.all([
    prisma.organization.create({ data: { name: `${tag}-A`, sector: 'test' } }),
    prisma.organization.create({ data: { name: `${tag}-B`, sector: 'test' } }),
  ]);
  orgA = a.id;
  orgB = b.id;
  const user = await prisma.user.create({
    data: { email: `${tag}@test.local`, name: 'Aïcha', passwordHash: 'x' },
  });
  userA = user.id;
  await prisma.membership.create({ data: { userId: userA, organizationId: orgA, role: 'OWNER' } });
  brandA = (await prisma.brand.create({ data: { organizationId: orgA, name: 'Marque A' } })).id;
  brandB = (await prisma.brand.create({ data: { organizationId: orgB, name: 'Marque B' } })).id;
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { name: { startsWith: tag } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: tag } } });
  await prisma.$disconnect();
});

const asA = <T>(fn: Parameters<typeof withTenant<T>>[2]) =>
  withTenant(prisma, { organizationId: orgA, userId: userA }, fn);

describe('isolation entre organisations (RLS)', () => {
  it('ne montre que les données de l’organisation active', async () => {
    const brands = await asA((tx) => tx.brand.findMany());
    expect(brands.map((b) => b.id)).toEqual([brandA]);
  });

  it('rend invisible une ligne d’une autre organisation, même par son id', async () => {
    expect(await asA((tx) => tx.brand.findUnique({ where: { id: brandB } }))).toBeNull();
    expect(await asA((tx) => tx.organization.findUnique({ where: { id: orgB } }))).toBeNull();
  });

  it('refuse l’écriture pour une autre organisation', async () => {
    await expect(
      asA((tx) => tx.brand.create({ data: { organizationId: orgB, name: 'Intrusion' } })),
    ).rejects.toThrow();
  });

  it('ne modifie ni ne supprime les lignes d’une autre organisation', async () => {
    const updated = await asA((tx) =>
      tx.brand.updateMany({ where: { id: brandB }, data: { name: 'Piraté' } }),
    );
    const deleted = await asA((tx) => tx.brand.deleteMany({ where: { id: brandB } }));
    expect(updated.count).toBe(0);
    expect(deleted.count).toBe(0);
    const intact = await prisma.brand.findUniqueOrThrow({ where: { id: brandB } });
    expect(intact.name).toBe('Marque B');
  });

  it('ne permet pas de déplacer une ligne vers une autre organisation', async () => {
    await expect(
      asA((tx) => tx.brand.update({ where: { id: brandA }, data: { organizationId: orgB } })),
    ).rejects.toThrow();
  });

  it('ne montre aucune donnée métier sans organisation active', async () => {
    const brands = await withUser(prisma, userA, (tx) => tx.brand.findMany());
    expect(brands).toEqual([]);
  });

  it('montre à l’utilisateur ses propres adhésions, et seulement elles', async () => {
    const memberships = await withUser(prisma, userA, (tx) => tx.membership.findMany());
    expect(memberships.map((m) => m.organizationId)).toEqual([orgA]);
  });

  it('montre à l’utilisateur ses organisations, et seulement elles', async () => {
    const orgs = await withUser(prisma, userA, (tx) => tx.organization.findMany());
    expect(orgs.map((o) => o.id)).toEqual([orgA]);
  });

  it('ne permet de modifier que l’organisation active', async () => {
    const updated = await asA((tx) =>
      tx.organization.updateMany({ where: { id: orgB }, data: { name: 'Piraté' } }),
    );
    expect(updated.count).toBe(0);
    await expect(
      asA((tx) => tx.organization.create({ data: { name: `${tag}-intrus`, sector: 'test' } })),
    ).rejects.toThrow();
  });

  it('isole les exports et leurs fichiers', async () => {
    const exportB = await prisma.export.create({
      data: { organizationId: orgB, brandId: brandB, type: 'LOGO_PACK', brandVersion: 1, watermarked: true, includesVector: false, storageKey: 'orgs/b/secret.zip' },
    });
    expect(await asA((tx) => tx.export.findUnique({ where: { id: exportB.id } }))).toBeNull();
    await expect(
      asA((tx) => tx.export.create({ data: { organizationId: orgB, brandId: brandB, type: 'LOGO_PACK', brandVersion: 1, watermarked: true, includesVector: false } })),
    ).rejects.toThrow();
  });

  it('n’expose pas les colonnes sensibles des utilisateurs', async () => {
    await expect(asA((tx) => tx.user.findMany())).rejects.toThrow();
    const users = await asA((tx) =>
      tx.user.findMany({ where: { id: userA }, select: { id: true, name: true } }),
    );
    expect(users).toEqual([{ id: userA, name: 'Aïcha' }]);
  });

  it('refuse un identifiant d’organisation mal formé', async () => {
    await expect(
      withTenant(prisma, { organizationId: "' OR 1=1 --" }, (tx) => tx.brand.findMany()),
    ).rejects.toThrow('Identifiant invalide');
  });
});
