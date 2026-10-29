// Factures et devis — §4.8 (US-60 à US-62, RG-60 à RG-64)
import type { INestApplication } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import request from 'supertest';
import { API, cleanup, createTestApp, registerUser } from './helpers.js';

let ctx: Awaited<ReturnType<typeof createTestApp>>;
let app: INestApplication;
const http = () => request(app.getHttpServer());
const YEAR = Number(new Intl.DateTimeFormat('en', { timeZone: 'Africa/Porto-Novo', year: 'numeric' }).format(new Date()));

const line = { label: 'Plat du jour', quantityMilli: 2000, unitPriceMinor: 2500, discountBps: 0, vatRateBps: 1800 };

beforeAll(async () => {
  ctx = await createTestApp();
  app = ctx.app;
});

afterAll(async () => {
  await cleanup(ctx.prisma);
  await app.close();
});

async function setup(plan: 'FREE' | 'PRO' = 'PRO') {
  const user = await registerUser(app);
  const org = await http().post(`${API}/organizations`).set('Cookie', user.cookie).send({ name: 'Chez Aïcha', sector: 'restauration', city: 'Cotonou' }).expect(201);
  const orgId = org.body.organization.id as string;
  const as = (req: request.Test) => req.set('Cookie', user.cookie).set('X-Organization-Id', orgId);
  await as(http().patch(`${API}/organizations/${orgId}`)).send({ rccm: 'RB/COT/24 B 12345', ifu: '3202412345678', address: 'Haie Vive' }).expect(200);
  await ctx.prisma.user.update({ where: { id: user.user.id }, data: { emailVerifiedAt: new Date() } });
  if (plan !== 'FREE') await ctx.prisma.subscription.update({ where: { organizationId: orgId }, data: { plan } });
  const client = await as(http().post(`${API}/clients`)).send({ name: 'Hôtel du Lac', address: 'Ganvié', ifu: '1234567890123' }).expect(201);
  return { ...user, orgId, as, clientId: client.body.client.id as string };
}

type Setup = Awaited<ReturnType<typeof setup>>;

async function draft(s: Setup, body: object = {}) {
  const res = await s.as(http().post(`${API}/documents`)).send({ type: 'INVOICE', clientId: s.clientId, lines: [line], ...body }).expect(201);
  return res.body.document as { id: string; totalMinor: number; status: string };
}

const issue = (s: Setup, id: string) => s.as(http().post(`${API}/documents/${id}/issue`));

describe('brouillons et calculs (US-60, RG-60, RG-61)', () => {
  it('calcule les totaux côté serveur', async () => {
    const s = await setup();
    const res = await s.as(http().post(`${API}/documents`))
      .send({ type: 'INVOICE', clientId: s.clientId, lines: [line, { ...line, label: 'Boisson', quantityMilli: 1500, unitPriceMinor: 999, discountBps: 1000 }], totalMinor: 1 })
      .expect(201);
    // 2 x 2 500 = 5 000 ; 1,5 x 999 = 1 499 - 150 = 1 349 ; HT 6 349 ; TVA 1 143 ; TTC 7 492
    expect(res.body.document).toMatchObject({ status: 'DRAFT', number: null, subtotalMinor: 6349, discountMinor: 150, vatMinor: 1143, totalMinor: 7492 });
    expect(res.body.document.paymentTerms).toMatch(/30 jours/);
  });

  it('applique 0 % de TVA si l’entreprise n’est pas assujettie', async () => {
    const s = await setup();
    await s.as(http().patch(`${API}/organizations/${s.orgId}`)).send({ vatEnabled: false }).expect(200);
    const doc = await draft(s);
    expect(doc).toMatchObject({ vatMinor: 0, totalMinor: 5000 });
  });

  it('valide les lignes', async () => {
    const s = await setup();
    await s.as(http().post(`${API}/documents`)).send({ type: 'INVOICE', lines: [] }).expect(400);
    await s.as(http().post(`${API}/documents`)).send({ type: 'INVOICE', lines: [{ ...line, unitPriceMinor: 12.5 }] }).expect(400);
    await s.as(http().post(`${API}/documents`)).send({ type: 'INVOICE', lines: [{ ...line, quantityMilli: 0 }] }).expect(400);
  });

  it('modifie et supprime un brouillon', async () => {
    const s = await setup();
    const doc = await draft(s);
    const res = await s.as(http().put(`${API}/documents/${doc.id}`)).send({ clientId: s.clientId, lines: [{ ...line, quantityMilli: 4000 }] }).expect(200);
    expect(res.body.document.subtotalMinor).toBe(10_000);
    await s.as(http().delete(`${API}/documents/${doc.id}`)).expect(204);
  });
});

describe('émission et numérotation (US-61, RG-62)', () => {
  it('numérote FAC-AAAA-0001 puis 0002, et les devis à part', async () => {
    const s = await setup();
    const a = await issue(s, (await draft(s)).id).expect(200);
    const b = await issue(s, (await draft(s)).id).expect(200);
    const q = await issue(s, (await draft(s, { type: 'QUOTE' })).id).expect(200);
    expect(a.body.document).toMatchObject({ status: 'ISSUED', number: `FAC-${YEAR}-0001` });
    expect(b.body.document.number).toBe(`FAC-${YEAR}-0002`);
    expect(q.body.document.number).toBe(`DEV-${YEAR}-0001`);
    expect(q.body.document.paymentTerms).toMatch(/valable 30 jours/);
  });

  it('attribue des numéros consécutifs sans doublon à 10 émissions simultanées', async () => {
    const s = await setup();
    const drafts = await Promise.all(Array.from({ length: 10 }, () => draft(s)));
    const results = await Promise.all(drafts.map((d) => issue(s, d.id)));
    expect(results.map((r) => r.status)).toEqual(Array(10).fill(200));
    const numbers = results.map((r) => r.body.document.number as string).sort();
    expect(numbers).toEqual(Array.from({ length: 10 }, (_, i) => `FAC-${YEAR}-${String(i + 1).padStart(4, '0')}`));
  });

  it('exige un client pour émettre', async () => {
    const s = await setup();
    const doc = await draft(s, { clientId: null });
    const res = await issue(s, doc.id).expect(422);
    expect(res.body.code).toBe('CLIENT_REQUIRED');
  });

  it('ne consomme pas de numéro quand l’émission est refusée (quota)', async () => {
    const s = await setup('FREE');
    for (let i = 0; i < 3; i++) await issue(s, (await draft(s)).id).expect(200);
    const blocked = await draft(s);
    const res = await issue(s, blocked.id).expect(402);
    expect(res.body).toMatchObject({ code: 'QUOTA_EXCEEDED', quota: 'businessDocumentsPerMonth', limit: 3 });

    await ctx.prisma.subscription.update({ where: { organizationId: s.orgId }, data: { plan: 'PRO' } });
    const next = await issue(s, blocked.id).expect(200);
    expect(next.body.document.number).toBe(`FAC-${YEAR}-0004`); // aucun trou
  });
});

describe('document émis (RG-63, RG-31, RG-64)', () => {
  it('ne peut plus être modifié ni supprimé', async () => {
    const s = await setup();
    const doc = await draft(s);
    await issue(s, doc.id).expect(200);
    const put = await s.as(http().put(`${API}/documents/${doc.id}`)).send({ clientId: s.clientId, lines: [line] }).expect(409);
    expect(put.body.code).toBe('DOCUMENT_ISSUED');
    await s.as(http().delete(`${API}/documents/${doc.id}`)).expect(409);
    await issue(s, doc.id).expect(409);
  });

  it('garde l’émetteur et le client tels qu’à l’émission', async () => {
    const s = await setup();
    const doc = await draft(s);
    await issue(s, doc.id).expect(200);
    await s.as(http().patch(`${API}/organizations/${s.orgId}`)).send({ name: 'Nouveau Nom' }).expect(200);
    await s.as(http().put(`${API}/clients/${s.clientId}`)).send({ name: 'Client renommé' }).expect(200);

    const res = await s.as(http().get(`${API}/documents/${doc.id}`)).expect(200);
    expect(res.body.document.issuer).toMatchObject({ name: 'Chez Aïcha', rccm: 'RB/COT/24 B 12345', ifu: '3202412345678' });
    expect(res.body.document.client).toMatchObject({ name: 'Hôtel du Lac', ifu: '1234567890123' });
    const preview = await s.as(http().get(`${API}/documents/${doc.id}/preview`)).expect(200);
    expect(preview.body.html).toContain('Hôtel du Lac');
    expect(preview.body.html).not.toContain('Client renommé');
  });

  it('affiche toutes les mentions obligatoires et le montant en lettres', async () => {
    const s = await setup();
    const doc = await draft(s, { dueDate: '2026-12-31' });
    const { body } = await issue(s, doc.id).expect(200);
    const { html } = (await s.as(http().get(`${API}/documents/${doc.id}/preview`)).expect(200)).body as { html: string };
    for (const mention of [body.document.number, 'Chez Aïcha', 'Haie Vive', 'RCCM', 'RB/COT/24 B 12345', 'IFU', '3202412345678', 'Hôtel du Lac', 'Plat du jour', 'Total HT', 'TVA 18 %', 'Total TTC', '5 900 FCFA', 'Cinq-mille-neuf-cents francs CFA', 'Paiement à 30 jours', 'Échéance']) {
      expect(html, mention).toContain(mention);
    }
  });

  it('se corrige par une facture d’avoir, qui l’annule', async () => {
    const s = await setup();
    const doc = await draft(s);
    await issue(s, doc.id).expect(200);
    const credit = await s.as(http().post(`${API}/documents/${doc.id}/credit-note`)).expect(201);
    expect(credit.body.document).toMatchObject({ type: 'CREDIT_NOTE', status: 'ISSUED', number: `AV-${YEAR}-0001`, correctsId: doc.id, totalMinor: 5900 });
    const original = await s.as(http().get(`${API}/documents/${doc.id}`)).expect(200);
    expect(original.body.document.status).toBe('CANCELLED');
    await s.as(http().post(`${API}/documents/${doc.id}/credit-note`)).expect(409);

    const { html } = (await s.as(http().get(`${API}/documents/${credit.body.document.id}/preview`)).expect(200)).body as { html: string };
    expect(html).toContain('Facture d’avoir');
    expect(html).toContain(`Avoir sur la facture FAC-${YEAR}-0001`);
    expect(html).toContain('-5 900 FCFA');
  });

  it('refuse un avoir sur un devis ou un brouillon', async () => {
    const s = await setup();
    const quote = await draft(s, { type: 'QUOTE' });
    await issue(s, quote.id).expect(200);
    await s.as(http().post(`${API}/documents/${quote.id}/credit-note`)).expect(409);
    await s.as(http().post(`${API}/documents/${(await draft(s)).id}/credit-note`)).expect(409);
  });

  it('duplique un document en nouveau brouillon', async () => {
    const s = await setup();
    const doc = await draft(s);
    await issue(s, doc.id).expect(200);
    const copy = await s.as(http().post(`${API}/documents/${doc.id}/duplicate`)).expect(201);
    expect(copy.body.document).toMatchObject({ status: 'DRAFT', number: null, totalMinor: 5900, clientId: s.clientId });
  });
});

describe('PDF (§4.8, §10)', () => {
  it('refuse un brouillon, produit le PDF d’un document émis en moins de 5 s', async () => {
    const s = await setup();
    const doc = await draft(s);
    const refused = await s.as(http().post(`${API}/exports`)).send({ type: 'BUSINESS_DOCUMENT_PDF', documentId: doc.id }).expect(409);
    expect(refused.body.code).toBe('DOCUMENT_DRAFT');

    const issued = await issue(s, doc.id).expect(200);
    const started = Date.now();
    const created = await s.as(http().post(`${API}/exports`)).send({ type: 'BUSINESS_DOCUMENT_PDF', documentId: doc.id }).expect(202);
    let current = created.body.export;
    while (!current.download && !current.failed) {
      await new Promise((r) => setTimeout(r, 200));
      current = (await s.as(http().get(`${API}/exports/${current.id}`)).expect(200)).body.export;
    }
    expect(Date.now() - started).toBeLessThan(5000);
    expect(current).toMatchObject({ status: 'SUCCEEDED', fileName: `${issued.body.document.number}-chez-aicha.pdf` });

    const file = await http()
      .get(current.download.url)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    const pdf = await PDFDocument.load(file.body as Buffer);
    expect(pdf.getPageCount()).toBe(1);

    // Pas décompté dans le quota d'exports haute définition
    const quota = await s.as(http().get(`${API}/exports/quota`)).expect(200);
    expect(quota.body.quota.used).toBe(0);
  });
});

describe('clients et produits (US-62)', () => {
  it('enregistre clients et produits, et valide l’IFU', async () => {
    const s = await setup();
    await s.as(http().post(`${API}/clients`)).send({ name: 'X', ifu: '123' }).expect(400);
    const product = await s.as(http().post(`${API}/products`)).send({ name: 'Plat du jour', unitPriceMinor: 2500, unit: 'portion' }).expect(201);
    expect(product.body.product).toMatchObject({ unitPriceMinor: 2500, vatRateBps: 1800, currency: 'XOF', unit: 'portion' });
    const list = await s.as(http().get(`${API}/products`)).expect(200);
    expect(list.body.products).toHaveLength(1);
    const clients = await s.as(http().get(`${API}/clients?q=lac`)).expect(200);
    expect(clients.body.clients.map((c: { name: string }) => c.name)).toEqual(['Hôtel du Lac']);
  });
});

describe('droits et isolation', () => {
  it('réserve les factures aux rôles autorisés (Comptable oui, Designer non)', async () => {
    const s = await setup();
    const doc = await draft(s);
    for (const [role, status] of [['ACCOUNTANT', 200], ['DESIGNER', 403], ['VIEWER', 403]] as const) {
      const member = await registerUser(app);
      await ctx.prisma.membership.create({ data: { userId: member.user.id, organizationId: s.orgId, role } });
      await http().get(`${API}/documents/${doc.id}`).set('Cookie', member.cookie).set('X-Organization-Id', s.orgId).expect(status);
    }
  });

  it('isole documents et clients entre entreprises', async () => {
    const aicha = await setup();
    const koffi = await setup();
    const doc = await draft(aicha);
    await koffi.as(http().get(`${API}/documents/${doc.id}`)).expect(404);
    await koffi.as(http().post(`${API}/documents/${doc.id}/issue`)).expect(404);
    await koffi.as(http().get(`${API}/documents/${doc.id}/preview`)).expect(404);
    await koffi.as(http().post(`${API}/documents`)).send({ type: 'INVOICE', clientId: aicha.clientId, lines: [line] }).expect(404);
    await koffi.as(http().post(`${API}/exports`)).send({ type: 'BUSINESS_DOCUMENT_PDF', documentId: doc.id }).expect(404);
    const list = await koffi.as(http().get(`${API}/documents`)).expect(200);
    expect(list.body.documents).toEqual([]);
  });
});
