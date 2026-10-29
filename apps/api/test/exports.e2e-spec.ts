// Exports — §4.4 (US-31), §4.5 (US-40, US-41), §6.2 (offres et quotas), §9.1 (liens signés)
import type { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { strFromU8, unzipSync } from 'fflate';
import request from 'supertest';
import { EXPORTS_QUEUE } from '../src/modules/exports/exports.service.js';
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
  avoidedColors: [],
};

beforeAll(async () => {
  ctx = await createTestApp();
  app = ctx.app;
});

afterAll(async () => {
  await cleanup(ctx.prisma);
  await app.close();
});

/** Organisation avec une marque complète ; e-mail vérifié sauf demande contraire. */
async function setup(options: { verified?: boolean; plan?: 'FREE' | 'STARTER'; identity?: boolean } = {}) {
  const { verified = true, plan = 'FREE', identity = true } = options;
  const user = await registerUser(app);
  const org = await http().post(`${API}/organizations`).set('Cookie', user.cookie).send({ name: 'Chez Aïcha', sector: 'restauration' }).expect(201);
  const orgId = org.body.organization.id as string;
  const as = (req: request.Test) => req.set('Cookie', user.cookie).set('X-Organization-Id', orgId);
  if (verified) await ctx.prisma.user.update({ where: { id: user.user.id }, data: { emailVerifiedAt: new Date() } });
  if (plan !== 'FREE') await ctx.prisma.subscription.update({ where: { organizationId: orgId }, data: { plan } });

  const brand = await as(http().post(`${API}/brands`)).send(brief).expect(201);
  const brandId = brand.body.brand.id as string;
  if (identity) {
    const gen = await as(http().post(`${API}/brands/${brandId}/generate`)).send({}).expect(200);
    const palette = gen.body.palettes[0] as { colors: { role: string; hex: string }[] };
    await as(http().put(`${API}/brands/${brandId}/identity`))
      .send({
        logo: gen.body.proposals[0],
        palette: { colors: palette.colors.map(({ role, hex }) => ({ role, hex })) },
        typography: { heading: gen.body.proposals[0].font, body: 'Inter' },
      })
      .expect(200);
  }
  return { ...user, orgId, brandId, as };
}

type Setup = Awaited<ReturnType<typeof setup>>;

async function requestExport(s: Setup, type: 'LOGO_PACK' | 'GUIDELINES_PDF', status = 202) {
  const res = await s.as(http().post(`${API}/exports`)).send({ brandId: s.brandId, type }).expect(status);
  return res.body;
}

/** Attend la fin de la tâche de fond. */
async function waitForExport(s: Setup, id: string, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await s.as(http().get(`${API}/exports/${id}`)).expect(200);
    if (['SUCCEEDED', 'FAILED', 'TIMED_OUT'].includes(res.body.export.status)) return res.body.export;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Export ${id} non terminé`);
}

function download(url: string) {
  return http()
    .get(url)
    .buffer(true)
    .parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
}

describe('contrôles avant export', () => {
  it('exige une adresse e-mail vérifiée (US-02)', async () => {
    const s = await setup({ verified: false });
    const body = await requestExport(s, 'LOGO_PACK', 403);
    expect(body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('exige une marque enregistrée', async () => {
    const s = await setup({ identity: false });
    const body = await requestExport(s, 'LOGO_PACK', 409);
    expect(body.code).toBe('BRAND_INCOMPLETE');
  });

  it('réserve la charte PDF aux offres payantes', async () => {
    const s = await setup();
    const body = await requestExport(s, 'GUIDELINES_PDF', 402);
    expect(body).toMatchObject({ code: 'PLAN_REQUIRED' });
  });

  it('limite l’offre Gratuite à 2 exports par mois', async () => {
    const s = await setup();
    await requestExport(s, 'LOGO_PACK');
    await requestExport(s, 'LOGO_PACK');
    const body = await requestExport(s, 'LOGO_PACK', 402);
    expect(body).toMatchObject({ code: 'QUOTA_EXCEEDED', quota: 'hdExportsPerMonth', limit: 2 });
    const quota = await s.as(http().get(`${API}/exports/quota`)).expect(200);
    expect(quota.body.quota).toMatchObject({ plan: 'FREE', used: 2, limit: 2, watermarked: true, vector: false });
  });
});

describe('US-31 pack de logos', () => {
  it('offre Gratuite : PNG avec filigrane, sans SVG, téléchargeable par lien signé', async () => {
    const s = await setup();
    const { export: created } = await requestExport(s, 'LOGO_PACK');
    expect(created).toMatchObject({ status: 'QUEUED', watermarked: true, includesVector: false, download: null });

    const done = await waitForExport(s, created.id);
    expect(done).toMatchObject({ status: 'SUCCEEDED', fileName: 'chez-aicha-logos-v1.zip' });
    expect(done.download.url).toMatch(/^\/api\/v1\/files\//);

    const file = await download(done.download.url).expect(200);
    expect(file.headers['content-type']).toBe('application/zip');
    expect(file.headers['content-disposition']).toContain('chez-aicha-logos-v1.zip');
    const names = Object.keys(unzipSync(file.body as Buffer));
    expect(names.some((n) => n.endsWith('.svg'))).toBe(false);
    expect(names.filter((n) => n.endsWith('.png')).length).toBeGreaterThanOrEqual(6);
  });

  it('offre Starter : SVG vectoriels sans texte, plus PNG', async () => {
    const s = await setup({ plan: 'STARTER' });
    const { export: created } = await requestExport(s, 'LOGO_PACK');
    expect(created).toMatchObject({ watermarked: false, includesVector: true });
    const done = await waitForExport(s, created.id);
    const files = unzipSync((await download(done.download.url).expect(200)).body as Buffer);
    const svg = strFromU8(files['chez-aicha-logos/svg/chez-aicha-couleur.svg']!);
    expect(svg).toMatch(/^<svg xmlns/);
    expect(svg).not.toContain('<text'); // RG-23 : texte vectorisé
  });
});

describe('US-40 charte graphique PDF', () => {
  it('génère le PDF en tâche de fond et prévient par e-mail (§4.11)', async () => {
    const s = await setup({ plan: 'STARTER' });
    const started = Date.now();
    const { export: created } = await requestExport(s, 'GUIDELINES_PDF');
    const done = await waitForExport(s, created.id);
    expect(done).toMatchObject({ status: 'SUCCEEDED', fileName: 'chez-aicha-charte-graphique-v1.pdf' });
    expect(Date.now() - started).toBeLessThan(30_000); // §10

    const file = await download(done.download.url).expect(200);
    expect(file.headers['content-type']).toBe('application/pdf');
    const pdf = file.body as Buffer;
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(7);

    const mail = ctx.mail.outbox.find((m) => m.to === s.user.email && m.subject.includes('charte graphique'));
    expect(mail?.text).toContain('/ma-marque/charte');
  });
});

describe('US-41 textes de la charte', () => {
  it('propose des textes, les enregistre corrigés et les utilise dans l’aperçu', async () => {
    const s = await setup();
    const initial = await s.as(http().get(`${API}/brands/${s.brandId}/guidelines`)).expect(200);
    expect(initial.body.edited).toBe(false);
    expect(initial.body.texts.presentation).toContain('Chez Aïcha');
    expect(initial.body.texts.values).toHaveLength(3);

    const texts = { ...initial.body.texts, mission: 'Servir les meilleurs plats de Cotonou <b>chaque jour</b>.' };
    await s.as(http().put(`${API}/brands/${s.brandId}/guidelines`)).send(texts).expect(200);
    const saved = await s.as(http().get(`${API}/brands/${s.brandId}/guidelines`)).expect(200);
    expect(saved.body).toMatchObject({ edited: true, texts: { mission: texts.mission } });

    const preview = await s.as(http().get(`${API}/brands/${s.brandId}/guidelines/preview`)).expect(200);
    expect(preview.body.html).toContain('chaque jour');
    expect(preview.body.html).not.toContain('<b>chaque jour</b>');
  });

  it('refuse un texte vide et interdit la modification à un Lecteur', async () => {
    const s = await setup();
    const { body } = await s.as(http().get(`${API}/brands/${s.brandId}/guidelines`)).expect(200);
    await s.as(http().put(`${API}/brands/${s.brandId}/guidelines`)).send({ ...body.texts, mission: '  ' }).expect(400);

    const viewer = await registerUser(app);
    await ctx.prisma.membership.create({ data: { userId: viewer.user.id, organizationId: s.orgId, role: 'VIEWER' } });
    await http()
      .put(`${API}/brands/${s.brandId}/guidelines`)
      .set('Cookie', viewer.cookie)
      .set('X-Organization-Id', s.orgId)
      .send(body.texts)
      .expect(403);
  });
});

describe('sécurité', () => {
  it('isole les exports entre organisations et refuse un lien modifié', async () => {
    const aicha = await setup();
    const koffi = await setup();
    const { export: created } = await requestExport(aicha, 'LOGO_PACK');
    const done = await waitForExport(aicha, created.id);

    await koffi.as(http().get(`${API}/exports/${created.id}`)).expect(404);
    await koffi.as(http().post(`${API}/exports`)).send({ brandId: aicha.brandId, type: 'LOGO_PACK' }).expect(404);

    const url = done.download.url as string;
    await download(`${url.slice(0, -3)}abc`).expect(403);
  });

  it('rend le quota si l’export échoue (après 2 essais)', async () => {
    const s = await setup();
    const queue = app.get<Queue>(getQueueToken(EXPORTS_QUEUE));
    await queue.pause();
    const { export: created } = await requestExport(s, 'LOGO_PACK');
    // Marque devenue inexploitable entre la demande et le traitement.
    await ctx.prisma.brand.update({ where: { id: s.brandId }, data: { logo: { invalide: true } } });
    await queue.resume();

    const done = await waitForExport(s, created.id);
    expect(done).toMatchObject({ status: 'FAILED', failed: true, download: null });
    const record = await ctx.prisma.export.findUniqueOrThrow({ where: { id: created.id } });
    expect(record.quotaCharged).toBe(false);
  });
});
