// Brand Studio — §4.3, §4.4, §6.2 (quotas), §8 (génération)
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { API, cleanup, createTestApp, registerUser } from './helpers.js';

let ctx: Awaited<ReturnType<typeof createTestApp>>;
let app: INestApplication;
const http = () => request(app.getHttpServer());

const brief = {
  name: 'Chez Aïcha',
  slogan: 'Le goût de Cotonou',
  sector: 'restauration',
  audience: ['familles'],
  values: ['convivialite', 'qualite', 'authenticite'],
  style: 'ludique',
  preferredColors: ['orange'],
  avoidedColors: ['violet'],
};

beforeAll(async () => {
  ctx = await createTestApp();
  app = ctx.app;
});

afterAll(async () => {
  await cleanup(ctx.prisma);
  await app.close();
});

async function owner() {
  const user = await registerUser(app);
  const res = await http()
    .post(`${API}/organizations`)
    .set('Cookie', user.cookie)
    .send({ name: 'Chez Aïcha', sector: 'restauration' })
    .expect(201);
  const orgId = res.body.organization.id as string;
  const as = (req: request.Test) => req.set('Cookie', user.cookie).set('X-Organization-Id', orgId);
  return { ...user, orgId, as };
}

async function ownerWithBrand() {
  const o = await owner();
  const res = await o.as(http().post(`${API}/brands`)).send(brief).expect(201);
  return { ...o, brandId: res.body.brand.id as string };
}

async function chargeGenerations(organizationId: string, count: number) {
  await ctx.prisma.aIGeneration.createMany({
    data: Array.from({ length: count }, () => ({
      organizationId,
      type: 'LOGO' as const,
      provider: 'test',
      model: 'test',
      status: 'SUCCEEDED' as const,
      quotaCharged: true,
    })),
  });
}

describe('US-20 création de la marque', () => {
  it('crée la marque à partir du questionnaire', async () => {
    const o = await owner();
    const res = await o.as(http().post(`${API}/brands`)).send(brief).expect(201);
    expect(res.body.brand).toMatchObject({ name: 'Chez Aïcha', slogan: 'Le goût de Cotonou', logo: null, version: 0 });

    const list = await o.as(http().get(`${API}/brands`)).expect(200);
    expect(list.body.brands).toHaveLength(1);
  });

  it('valide le questionnaire', async () => {
    const o = await owner();
    const res = await o.as(http().post(`${API}/brands`)).send({ ...brief, values: ['qualite'] }).expect(400);
    expect(res.body.errors[0]).toMatchObject({ field: 'values', message: 'Choisissez exactement 3 valeurs' });
  });

  it('limite le nombre de marques selon l’offre (Gratuit : 1)', async () => {
    const o = await ownerWithBrand();
    const res = await o.as(http().post(`${API}/brands`)).send(brief).expect(402);
    expect(res.body).toMatchObject({ code: 'QUOTA_EXCEEDED', quota: 'brands', limit: 1 });
  });

  it('exige l’en-tête d’organisation', async () => {
    const o = await owner();
    await http().get(`${API}/brands`).set('Cookie', o.cookie).expect(404);
  });
});

describe('isolation et droits', () => {
  it('rend la marque d’une autre organisation introuvable', async () => {
    const aicha = await ownerWithBrand();
    const koffi = await owner();
    // Avec sa propre organisation : la marque d'Aïcha n'existe pas pour lui (RLS).
    await koffi.as(http().get(`${API}/brands/${aicha.brandId}`)).expect(404);
    await koffi.as(http().post(`${API}/brands/${aicha.brandId}/generate`)).send({}).expect(404);
    // En se faisant passer pour l'organisation d'Aïcha : refusé par TenantGuard.
    await http()
      .get(`${API}/brands/${aicha.brandId}`)
      .set('Cookie', koffi.cookie)
      .set('X-Organization-Id', aicha.orgId)
      .expect(404);
  });

  it('laisse un Lecteur consulter mais pas modifier la marque', async () => {
    const o = await ownerWithBrand();
    const viewer = await registerUser(app);
    await ctx.prisma.membership.create({ data: { userId: viewer.user.id, organizationId: o.orgId, role: 'VIEWER' } });
    const asViewer = (req: request.Test) => req.set('Cookie', viewer.cookie).set('X-Organization-Id', o.orgId);

    await asViewer(http().get(`${API}/brands/${o.brandId}`)).expect(200);
    await asViewer(http().post(`${API}/brands/${o.brandId}/generate`)).send({}).expect(403);
  });
});

describe('US-21 génération des logos', () => {
  it('propose 6 logos et 3 palettes, et compte la génération', async () => {
    const o = await ownerWithBrand();
    const res = await o.as(http().post(`${API}/brands/${o.brandId}/generate`)).send({}).expect(200);

    expect(res.body.proposals).toHaveLength(6);
    expect(res.body.palettes).toHaveLength(3);
    expect(res.body.creative.directions).toHaveLength(3);
    expect(res.body.quota).toEqual({ used: 1, limit: 12, warning: false });

    const generation = await ctx.prisma.aIGeneration.findUniqueOrThrow({ where: { id: res.body.generationId } });
    expect(generation).toMatchObject({ organizationId: o.orgId, provider: 'rules', quotaCharged: true });
  });

  it('donne d’autres propositions à la demande', async () => {
    const o = await ownerWithBrand();
    const first = await o.as(http().post(`${API}/brands/${o.brandId}/generate`)).send({ attempt: 0 }).expect(200);
    const second = await o.as(http().post(`${API}/brands/${o.brandId}/generate`)).send({ attempt: 1 }).expect(200);
    expect(second.body.proposals).not.toEqual(first.body.proposals);
  });

  it('prévient à 80 % et bloque à 100 % du quota mensuel (RG-71)', async () => {
    const o = await ownerWithBrand();
    await chargeGenerations(o.orgId, 9);
    const warned = await o.as(http().post(`${API}/brands/${o.brandId}/generate`)).send({}).expect(200);
    expect(warned.body.quota).toEqual({ used: 10, limit: 12, warning: true });

    await chargeGenerations(o.orgId, 2);
    const blocked = await o.as(http().post(`${API}/brands/${o.brandId}/generate`)).send({}).expect(402);
    expect(blocked.body).toMatchObject({ code: 'QUOTA_EXCEEDED', used: 12, limit: 12 });
    expect(blocked.body.message).toMatch(/offre supérieure/);
  });

  it('ne compte pas les générations échouées (§8.5)', async () => {
    const o = await ownerWithBrand();
    await ctx.prisma.aIGeneration.createMany({
      data: Array.from({ length: 12 }, () => ({
        organizationId: o.orgId,
        type: 'LOGO' as const,
        provider: 'test',
        model: 'test',
        status: 'TIMED_OUT' as const,
        quotaCharged: false,
      })),
    });
    await o.as(http().post(`${API}/brands/${o.brandId}/generate`)).send({}).expect(200);
  });

  it('ne dépasse pas le quota avec des demandes simultanées', async () => {
    const o = await ownerWithBrand();
    await chargeGenerations(o.orgId, 11);
    const results = await Promise.all(
      Array.from({ length: 4 }, (_, i) => o.as(http().post(`${API}/brands/${o.brandId}/generate`)).send({ attempt: i })),
    );
    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([200, 402, 402, 402]);
    const charged = await ctx.prisma.aIGeneration.count({ where: { organizationId: o.orgId, quotaCharged: true } });
    expect(charged).toBe(12);
  });
});

describe('US-22, US-25, US-26 enregistrement de l’identité', () => {
  async function proposal(o: Awaited<ReturnType<typeof ownerWithBrand>>) {
    const res = await o.as(http().post(`${API}/brands/${o.brandId}/generate`)).send({}).expect(200);
    const palette = res.body.palettes[0] as { harmony: string; colors: { role: string; hex: string }[] };
    return {
      logo: res.body.proposals[0],
      palette: { harmony: palette.harmony, colors: palette.colors.map(({ role, hex }) => ({ role, hex })) },
      typography: { heading: res.body.proposals[0].font, body: 'Inter' },
    };
  }

  it('enregistre logo, palette (HEX, RGB, CMJN) et polices, et crée une version', async () => {
    const o = await ownerWithBrand();
    const identity = await proposal(o);
    identity.logo.name = 'Chez Aïcha Cotonou';

    const res = await o.as(http().put(`${API}/brands/${o.brandId}/identity`)).send(identity).expect(200);
    expect(res.body.brand).toMatchObject({ name: 'Chez Aïcha Cotonou', version: 1, typography: identity.typography });
    expect(res.body.brand.logo).toEqual(identity.logo);
    const primary = res.body.brand.palette.colors.find((c: { role: string }) => c.role === 'primary');
    expect(primary).toMatchObject({ hex: expect.stringMatching(/^#[0-9a-f]{6}$/) });
    expect(primary.rgb).toHaveLength(3);
    expect(primary.cmyk).toHaveLength(4);

    const version = await ctx.prisma.brandVersion.findFirstOrThrow({ where: { brandId: o.brandId } });
    expect(version.number).toBe(1);
  });

  it('garde une seule palette active et incrémente la version', async () => {
    const o = await ownerWithBrand();
    const identity = await proposal(o);
    await o.as(http().put(`${API}/brands/${o.brandId}/identity`)).send(identity).expect(200);
    const res = await o.as(http().put(`${API}/brands/${o.brandId}/identity`)).send(identity).expect(200);
    expect(res.body.brand.version).toBe(2);
    expect(await ctx.prisma.colorPalette.count({ where: { brandId: o.brandId, isActive: true } })).toBe(1);
    expect(await ctx.prisma.brandVersion.count({ where: { brandId: o.brandId } })).toBe(2);
  });

  it('refuse une police hors liste (RG-24), une palette incomplète (RG-20) ou une icône inconnue', async () => {
    const o = await ownerWithBrand();
    const identity = await proposal(o);
    const save = (body: object) => o.as(http().put(`${API}/brands/${o.brandId}/identity`)).send(body);

    await save({ ...identity, typography: { heading: 'Comic Sans MS', body: 'Inter' } }).expect(400);
    await save({ ...identity, palette: { colors: identity.palette.colors.slice(0, 4) } }).expect(400);
    await save({ ...identity, logo: { ...identity.logo, layout: 'icon-left', iconId: 'icone-pirate' } }).expect(400);
  });
});
