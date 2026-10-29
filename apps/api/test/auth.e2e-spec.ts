// Comptes et authentification — §4.1 (US-01 à US-04, US-07, RG-01 à RG-04)
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  API,
  cleanup,
  createTestApp,
  lastTokenSentTo,
  registerUser,
  sessionCookie,
  sessionCookieHeader,
  STRONG_PASSWORD,
  uniqueEmail,
} from './helpers.js';

let ctx: Awaited<ReturnType<typeof createTestApp>>;
let app: INestApplication;
const http = () => request(app.getHttpServer());

beforeAll(async () => {
  ctx = await createTestApp();
  app = ctx.app;
});

afterAll(async () => {
  await cleanup(ctx.prisma);
  await app.close();
});

describe('US-01 inscription', () => {
  it('crée le compte, ouvre une session et hache le mot de passe en Argon2id', async () => {
    const email = uniqueEmail();
    const res = await http()
      .post(`${API}/auth/register`)
      .send({ name: 'Aïcha', email: email.toUpperCase(), password: STRONG_PASSWORD })
      .expect(201);

    expect(res.body.user).toMatchObject({ email, name: 'Aïcha', emailVerified: false });
    expect(res.body.user.passwordHash).toBeUndefined();
    const setCookie = sessionCookieHeader(res);
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/SameSite=Lax/);

    const stored = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('refuse un mot de passe de moins de 10 caractères (RG-01)', async () => {
    const res = await http()
      .post(`${API}/auth/register`)
      .send({ name: 'Koffi', email: uniqueEmail(), password: 'court123' })
      .expect(400);
    expect(res.body.errors[0].field).toBe('password');
  });

  it('refuse une adresse déjà utilisée', async () => {
    const email = uniqueEmail();
    await registerUser(app, email);
    await http()
      .post(`${API}/auth/register`)
      .send({ name: 'Doublon', email, password: STRONG_PASSWORD })
      .expect(409);
  });
});

describe('US-02 vérification de l’e-mail', () => {
  it('valide l’adresse avec le lien reçu, une seule fois', async () => {
    const { cookie, user } = await registerUser(app);
    const token = lastTokenSentTo(ctx.mail, user.email);

    await http().post(`${API}/auth/verify-email`).send({ token }).expect(204);
    const me = await http().get(`${API}/auth/me`).set('Cookie', cookie).expect(200);
    expect(me.body.user.emailVerified).toBe(true);

    await http().post(`${API}/auth/verify-email`).send({ token }).expect(400);
  });

  it('refuse un jeton inventé', async () => {
    await http().post(`${API}/auth/verify-email`).send({ token: 'x'.repeat(43) }).expect(400);
  });
});

describe('connexion', () => {
  it('connecte avec les bons identifiants', async () => {
    const { user } = await registerUser(app);
    const res = await http()
      .post(`${API}/auth/login`)
      .send({ email: user.email, password: STRONG_PASSWORD })
      .expect(200);
    expect(sessionCookie(res)).toBeTruthy();
  });

  it('donne le même message pour un e-mail inconnu et un mauvais mot de passe', async () => {
    const { user } = await registerUser(app);
    const wrong = await http()
      .post(`${API}/auth/login`)
      .send({ email: user.email, password: 'mauvais-mot-de-passe' })
      .expect(401);
    const unknown = await http()
      .post(`${API}/auth/login`)
      .send({ email: uniqueEmail('inconnu'), password: 'mauvais-mot-de-passe' })
      .expect(401);
    expect(wrong.body.message).toBe(unknown.body.message);
  });

  it('verrouille le compte après 5 échecs en 15 minutes (RG-02)', async () => {
    const { user } = await registerUser(app);
    for (let i = 0; i < 5; i++) {
      await http().post(`${API}/auth/login`).send({ email: user.email, password: 'mauvais-mdp' }).expect(401);
    }
    // Même le bon mot de passe est refusé pendant le verrouillage.
    const locked = await http()
      .post(`${API}/auth/login`)
      .send({ email: user.email, password: STRONG_PASSWORD })
      .expect(429);
    expect(locked.body.message).toMatch(/15 minutes/);
  });

  it('protège les routes privées', async () => {
    await http().get(`${API}/auth/me`).expect(401);
    await http().get(`${API}/auth/me`).set('Cookie', 'session=jeton-invente').expect(401);
  });
});

describe('US-03 mot de passe oublié', () => {
  it('répond pareil pour un e-mail inconnu, sans rien envoyer', async () => {
    const email = uniqueEmail('inconnu');
    await http().post(`${API}/auth/forgot-password`).send({ email }).expect(204);
    expect(ctx.mail.outbox.some((m) => m.to === email)).toBe(false);
  });

  it('réinitialise avec un lien à usage unique et ferme toutes les sessions (RG-03)', async () => {
    const { cookie, user } = await registerUser(app);
    await http().post(`${API}/auth/forgot-password`).send({ email: user.email }).expect(204);
    const token = lastTokenSentTo(ctx.mail, user.email);
    const newPassword = 'Porto-Novo-Nouveau-2026';

    await http().post(`${API}/auth/reset-password`).send({ token, password: newPassword }).expect(204);
    await http().post(`${API}/auth/reset-password`).send({ token, password: newPassword }).expect(400);

    await http().get(`${API}/auth/me`).set('Cookie', cookie).expect(401);
    await http().post(`${API}/auth/login`).send({ email: user.email, password: STRONG_PASSWORD }).expect(401);
    await http().post(`${API}/auth/login`).send({ email: user.email, password: newPassword }).expect(200);
  });

  it('refuse un lien expiré (30 minutes)', async () => {
    const { user } = await registerUser(app);
    await http().post(`${API}/auth/forgot-password`).send({ email: user.email }).expect(204);
    const token = lastTokenSentTo(ctx.mail, user.email);
    await ctx.prisma.verificationToken.updateMany({
      where: { userId: user.id, purpose: 'PASSWORD_RESET' },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await http()
      .post(`${API}/auth/reset-password`)
      .send({ token, password: 'Parakou-Nouveau-2026' })
      .expect(400);
  });
});

describe('US-04 sessions actives', () => {
  it('liste les sessions et déconnecte un autre appareil', async () => {
    const { cookie: phone, user } = await registerUser(app);
    const laptopRes = await http()
      .post(`${API}/auth/login`)
      .set('User-Agent', 'Ordinateur')
      .send({ email: user.email, password: STRONG_PASSWORD })
      .expect(200);
    const laptop = sessionCookie(laptopRes);

    const list = await http().get(`${API}/auth/sessions`).set('Cookie', phone).expect(200);
    expect(list.body.sessions).toHaveLength(2);
    const other = list.body.sessions.find((s: { current: boolean }) => !s.current);

    await http().delete(`${API}/auth/sessions/${other.id}`).set('Cookie', phone).expect(204);
    await http().get(`${API}/auth/me`).set('Cookie', laptop).expect(401);
    await http().get(`${API}/auth/me`).set('Cookie', phone).expect(200);
  });

  it('ne permet pas de révoquer la session d’un autre utilisateur', async () => {
    const alice = await registerUser(app);
    const bob = await registerUser(app);
    const bobSessions = await http().get(`${API}/auth/sessions`).set('Cookie', bob.cookie);
    const bobSessionId = bobSessions.body.sessions[0].id;

    await http().delete(`${API}/auth/sessions/${bobSessionId}`).set('Cookie', alice.cookie).expect(404);
    await http().get(`${API}/auth/me`).set('Cookie', bob.cookie).expect(200);
  });

  it('déconnecte la session courante', async () => {
    const { cookie } = await registerUser(app);
    await http().post(`${API}/auth/logout`).set('Cookie', cookie).expect(204);
    await http().get(`${API}/auth/me`).set('Cookie', cookie).expect(401);
  });
});

describe('US-07 suppression du compte (RG-04)', () => {
  it('exige le mot de passe, programme la suppression à 30 jours et ferme les sessions', async () => {
    const { cookie, user } = await registerUser(app);
    await http()
      .post(`${API}/auth/delete-account`)
      .set('Cookie', cookie)
      .send({ password: 'pas-le-bon' })
      .expect(401);

    const res = await http()
      .post(`${API}/auth/delete-account`)
      .set('Cookie', cookie)
      .send({ password: STRONG_PASSWORD })
      .expect(201);
    const days = (new Date(res.body.effectiveAt).getTime() - Date.now()) / 86_400_000;
    expect(Math.round(days)).toBe(30);
    await http().get(`${API}/auth/me`).set('Cookie', cookie).expect(401);

    const stored = await ctx.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.status).toBe('PENDING_DELETION');
  });

  it('annule la suppression si l’utilisateur se reconnecte pendant le délai', async () => {
    const { cookie, user } = await registerUser(app);
    await http()
      .post(`${API}/auth/delete-account`)
      .set('Cookie', cookie)
      .send({ password: STRONG_PASSWORD })
      .expect(201);
    await http().post(`${API}/auth/login`).send({ email: user.email, password: STRONG_PASSWORD }).expect(200);

    const stored = await ctx.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.status).not.toBe('PENDING_DELETION');
    expect(stored.deletionRequestedAt).toBeNull();
  });
});
