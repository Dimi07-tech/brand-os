// Cartes de visite — §4.7 (US-50, US-51, US-53), RG-40, RG-50
import type { INestApplication } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import request from 'supertest';
import { inflateSync } from 'node:zlib';
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

const composition = {
  schemaVersion: 1,
  kind: 'BUSINESS_CARD',
  templateId: 'classique-couleur',
  qr: 'whatsapp',
  fields: {
    fullName: 'Aïcha Dossou',
    jobTitle: 'Gérante',
    phone: '+229 01 97 00 00 00',
    email: 'aicha@chezaicha.bj',
    website: 'www.chezaicha.bj',
    address: 'Haie Vive, Cotonou',
  },
};

beforeAll(async () => {
  ctx = await createTestApp();
  app = ctx.app;
});

afterAll(async () => {
  await cleanup(ctx.prisma);
  await app.close();
});

async function setup(options: { identity?: boolean; plan?: 'FREE' | 'STARTER' } = {}) {
  const user = await registerUser(app);
  const org = await http().post(`${API}/organizations`).set('Cookie', user.cookie).send({ name: 'Chez Aïcha', sector: 'restauration' }).expect(201);
  const orgId = org.body.organization.id as string;
  const as = (req: request.Test) => req.set('Cookie', user.cookie).set('X-Organization-Id', orgId);
  await ctx.prisma.user.update({ where: { id: user.user.id }, data: { emailVerifiedAt: new Date() } });
  if (options.plan === 'STARTER') await ctx.prisma.subscription.update({ where: { organizationId: orgId }, data: { plan: 'STARTER' } });
  const brand = await as(http().post(`${API}/brands`)).send(brief).expect(201);
  const brandId = brand.body.brand.id as string;
  if (options.identity !== false) {
    const gen = await as(http().post(`${API}/brands/${brandId}/generate`)).send({}).expect(200);
    const palette = gen.body.palettes[0] as { colors: { role: string; hex: string }[] };
    await as(http().put(`${API}/brands/${brandId}/identity`))
      .send({ logo: gen.body.proposals[0], palette: { colors: palette.colors.map(({ role, hex }) => ({ role, hex })) }, typography: { heading: gen.body.proposals[0].font, body: 'Inter' } })
      .expect(200);
  }
  return { ...user, orgId, brandId, as };
}

type Setup = Awaited<ReturnType<typeof setup>>;

async function createCard(s: Setup, overrides: object = {}) {
  const res = await s.as(http().post(`${API}/designs`)).send({ brandId: s.brandId, composition: { ...composition, ...overrides } }).expect(201);
  return res.body.design as { id: string; version: number; name: string };
}

async function exportCard(s: Setup, designId: string) {
  const { body } = await s.as(http().post(`${API}/exports`)).send({ type: 'BUSINESS_CARD_PDF', designId }).expect(202);
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const res = await s.as(http().get(`${API}/exports/${body.export.id}`)).expect(200);
    if (res.body.export.status !== 'QUEUED' && res.body.export.status !== 'RUNNING') return res.body.export;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('export non terminé');
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

/** Contenu des flux du PDF, décompressés, pour inspecter les opérateurs de couleur. */
function pdfContent(pdf: Buffer): string {
  const raw = pdf.toString('latin1');
  const parts = [raw];
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    try {
      parts.push(inflateSync(Buffer.from(m[1]!, 'latin1')).toString('latin1'));
    } catch {
      // flux non compressé ou binaire (police, image)
    }
  }
  return parts.join('\n');
}

describe('créations (US-50, US-51)', () => {
  it('crée une carte à partir d’un modèle, la relit et la liste', async () => {
    const s = await setup();
    const card = await createCard(s);
    expect(card).toMatchObject({ version: 1, name: 'Carte de visite · Aïcha Dossou' });
    const read = await s.as(http().get(`${API}/designs/${card.id}`)).expect(200);
    expect(read.body.design.composition.fields.fullName).toBe('Aïcha Dossou');
    const list = await s.as(http().get(`${API}/designs`)).expect(200);
    expect(list.body.designs).toHaveLength(1);
  });

  it('valide le modèle et les champs', async () => {
    const s = await setup();
    await s.as(http().post(`${API}/designs`)).send({ brandId: s.brandId, composition: { ...composition, templateId: 'inconnu' } }).expect(400);
    await s.as(http().post(`${API}/designs`)).send({ brandId: s.brandId, composition: { ...composition, fields: { fullName: '' } } }).expect(400);
  });

  it('exige une marque enregistrée', async () => {
    const s = await setup({ identity: false });
    const res = await s.as(http().post(`${API}/designs`)).send({ brandId: s.brandId, composition }).expect(409);
    expect(res.body.code).toBe('BRAND_INCOMPLETE');
  });

  it('refuse d’écraser une modification faite ailleurs (RG-40)', async () => {
    const s = await setup();
    const card = await createCard(s);
    const edited = { ...composition, fields: { ...composition.fields, jobTitle: 'Fondatrice' } };
    const first = await s.as(http().put(`${API}/designs/${card.id}`)).send({ composition: edited, version: 1 }).expect(200);
    expect(first.body.design.version).toBe(2);

    // Un second onglet, resté sur la version 1, tente d'enregistrer.
    const stale = await s.as(http().put(`${API}/designs/${card.id}`)).send({ composition, version: 1 }).expect(409);
    expect(stale.body).toMatchObject({ code: 'VERSION_CONFLICT', current: { version: 2 } });
    expect(stale.body.current.composition.fields.jobTitle).toBe('Fondatrice');
  });

  it('laisse un Lecteur consulter, pas créer ni modifier', async () => {
    const s = await setup();
    const card = await createCard(s);
    const viewer = await registerUser(app);
    await ctx.prisma.membership.create({ data: { userId: viewer.user.id, organizationId: s.orgId, role: 'VIEWER' } });
    const asViewer = (req: request.Test) => req.set('Cookie', viewer.cookie).set('X-Organization-Id', s.orgId);
    await asViewer(http().get(`${API}/designs/${card.id}`)).expect(200);
    await asViewer(http().post(`${API}/designs`)).send({ brandId: s.brandId, composition }).expect(403);
    await asViewer(http().put(`${API}/designs/${card.id}`)).send({ composition, version: 1 }).expect(403);
  });

  it('isole les cartes entre organisations', async () => {
    const aicha = await setup();
    const koffi = await setup();
    const card = await createCard(aicha);
    await koffi.as(http().get(`${API}/designs/${card.id}`)).expect(404);
    await koffi.as(http().put(`${API}/designs/${card.id}`)).send({ composition, version: 1 }).expect(404);
    await koffi.as(http().post(`${API}/exports`)).send({ type: 'BUSINESS_CARD_PDF', designId: card.id }).expect(404);
    await koffi.as(http().post(`${API}/designs`)).send({ brandId: aicha.brandId, composition }).expect(404);
  });

  it('supprime une carte', async () => {
    const s = await setup();
    const card = await createCard(s);
    await s.as(http().delete(`${API}/designs/${card.id}`)).expect(204);
    await s.as(http().get(`${API}/designs/${card.id}`)).expect(404);
  });
});

describe('PDF pour l’imprimeur (US-53, RG-50)', () => {
  it('produit recto et verso au format fond perdu, en CMJN, avec le cadre de coupe', async () => {
    const s = await setup({ plan: 'STARTER' });
    const card = await createCard(s);
    const done = await exportCard(s, card.id);
    expect(done).toMatchObject({ status: 'SUCCEEDED', fileName: 'chez-aicha-carte-de-visite-aicha-dossou.pdf', watermarked: false });

    const file = await download(done.download.url).expect(200);
    const pdf = file.body as Buffer;
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(2);

    const mm = (pt: number) => (pt * 25.4) / 72;
    for (const page of doc.getPages()) {
      const media = page.getMediaBox();
      const trim = page.getTrimBox();
      expect(mm(media.width)).toBeCloseTo(91, 0);
      expect(mm(media.height)).toBeCloseTo(61, 0);
      expect(mm(trim.width)).toBeCloseTo(85, 0);
      expect(mm(trim.height)).toBeCloseTo(55, 0);
      expect(mm(trim.x)).toBeCloseTo(3, 1);
    }

    const content = pdfContent(pdf);
    expect(content).not.toMatch(/DeviceRGB/);
    expect(content).not.toMatch(/[\d.]+ [\d.]+ [\d.]+ (rg|RG)\b/); // aucune couleur RGB
    expect(content).toMatch(/[\d.]+ [\d.]+ [\d.]+ [\d.]+ (k|K)\b/); // couleurs CMJN
  });

  it('ajoute un filigrane en offre Gratuite', async () => {
    const s = await setup();
    const card = await createCard(s);
    const done = await exportCard(s, card.id);
    expect(done).toMatchObject({ status: 'SUCCEEDED', watermarked: true });
  });
});
