// Organisations — §4.2 (US-10, US-11, RG-10, RG-11)
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { API, cleanup, createTestApp, registerUser } from './helpers.js';

let ctx: Awaited<ReturnType<typeof createTestApp>>;
let app: INestApplication;
const http = () => request(app.getHttpServer());

const restaurant = { name: 'Chez Aïcha', sector: 'restauration', city: 'Cotonou' };

beforeAll(async () => {
  ctx = await createTestApp();
  app = ctx.app;
});

afterAll(async () => {
  await cleanup(ctx.prisma);
  await app.close();
});

async function userWithOrganization() {
  const user = await registerUser(app);
  const res = await http().post(`${API}/organizations`).set('Cookie', user.cookie).send(restaurant).expect(201);
  return { ...user, orgId: res.body.organization.id as string };
}

describe('US-10 création de l’entreprise', () => {
  it('crée l’organisation avec l’utilisateur comme Propriétaire et l’offre Gratuite', async () => {
    const { cookie, user, orgId } = await userWithOrganization();

    const list = await http().get(`${API}/organizations`).set('Cookie', cookie).expect(200);
    expect(list.body.organizations).toEqual([
      expect.objectContaining({ id: orgId, name: 'Chez Aïcha', currency: 'XOF', country: 'BJ', role: 'OWNER' }),
    ]);

    const membership = await ctx.prisma.membership.findFirstOrThrow({ where: { organizationId: orgId } });
    expect(membership).toMatchObject({ userId: user.id, role: 'OWNER' });
    const subscription = await ctx.prisma.subscription.findUniqueOrThrow({ where: { organizationId: orgId } });
    expect(subscription.plan).toBe('FREE');
    const audit = await ctx.prisma.auditLog.findFirst({ where: { organizationId: orgId, action: 'organization.create' } });
    expect(audit?.actorId).toBe(user.id);
  });

  it('limite à une organisation par compte au MVP', async () => {
    const { cookie } = await userWithOrganization();
    await http().post(`${API}/organizations`).set('Cookie', cookie).send(restaurant).expect(409);
  });

  it('valide le secteur', async () => {
    const { cookie } = await registerUser(app);
    await http()
      .post(`${API}/organizations`)
      .set('Cookie', cookie)
      .send({ ...restaurant, sector: 'inconnu' })
      .expect(400);
  });

  it('exige une session', async () => {
    await http().post(`${API}/organizations`).send(restaurant).expect(401);
  });
});

describe('US-11 informations légales', () => {
  it('enregistre RCCM, IFU, adresse et régime fiscal', async () => {
    const { cookie, orgId } = await userWithOrganization();
    const res = await http()
      .patch(`${API}/organizations/${orgId}`)
      .set('Cookie', cookie)
      .send({ rccm: 'RB/COT/24 B 12345', ifu: '3202412345678', address: 'Haie Vive, Cotonou', taxRegime: 'TPS' })
      .expect(200);
    expect(res.body.organization).toMatchObject({ rccm: 'RB/COT/24 B 12345', ifu: '3202412345678' });

    const audit = await ctx.prisma.auditLog.findFirst({ where: { organizationId: orgId, action: 'organization.update' } });
    // Seuls les champs envoyés sont modifiés : pas de valeur par défaut réinjectée.
    expect((audit!.metadata as { fields: string[] }).fields.sort()).toEqual(['address', 'ifu', 'rccm', 'taxRegime']);
  });

  it('ne modifie pas la devise ni le pays quand ils ne sont pas envoyés', async () => {
    const { cookie, orgId } = await userWithOrganization();
    await http().patch(`${API}/organizations/${orgId}`).set('Cookie', cookie).send({ currency: 'EUR' }).expect(200);
    const res = await http().patch(`${API}/organizations/${orgId}`).set('Cookie', cookie).send({ city: 'Parakou' }).expect(200);
    expect(res.body.organization).toMatchObject({ currency: 'EUR', country: 'BJ', city: 'Parakou' });
  });

  it('accepte les champs facultatifs vides, comme le formulaire les envoie', async () => {
    const { cookie, orgId } = await userWithOrganization();
    const res = await http()
      .patch(`${API}/organizations/${orgId}`)
      .set('Cookie', cookie)
      .send({ email: '', phone: '', website: '', ifu: '' })
      .expect(200);
    expect(res.body.organization).toMatchObject({ email: null, phone: null, website: null, ifu: null });
  });

  it('refuse un IFU qui n’a pas 13 chiffres', async () => {
    const { cookie, orgId } = await userWithOrganization();
    await http().patch(`${API}/organizations/${orgId}`).set('Cookie', cookie).send({ ifu: '12345' }).expect(400);
  });
});

describe('isolation et droits (RG-10)', () => {
  it('répond 404 sur l’organisation d’un autre, en lecture comme en écriture', async () => {
    const aicha = await userWithOrganization();
    const koffi = await userWithOrganization();

    await http().get(`${API}/organizations/${aicha.orgId}`).set('Cookie', koffi.cookie).expect(404);
    await http()
      .patch(`${API}/organizations/${aicha.orgId}`)
      .set('Cookie', koffi.cookie)
      .send({ name: 'Piraté' })
      .expect(404);

    const intact = await ctx.prisma.organization.findUniqueOrThrow({ where: { id: aicha.orgId } });
    expect(intact.name).toBe('Chez Aïcha');
  });

  it('interdit la modification à un rôle sans le droit', async () => {
    const owner = await userWithOrganization();
    const viewer = await registerUser(app);
    await ctx.prisma.membership.create({
      data: { userId: viewer.user.id, organizationId: owner.orgId, role: 'VIEWER' },
    });

    const read = await http().get(`${API}/organizations/${owner.orgId}`).set('Cookie', viewer.cookie).expect(200);
    expect(read.body.organization.role).toBe('VIEWER');
    await http()
      .patch(`${API}/organizations/${owner.orgId}`)
      .set('Cookie', viewer.cookie)
      .send({ name: 'Nouveau nom' })
      .expect(403);
  });

  it('refuse un identifiant d’organisation mal formé', async () => {
    const { cookie } = await registerUser(app);
    await http().get(`${API}/organizations/pas-un-uuid`).set('Cookie', cookie).expect(404);
  });
});
