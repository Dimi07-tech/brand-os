import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { MailService } from '../src/modules/mail/mail.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

export const API = '/api/v1';
const TEST_DOMAIN = 'e2e.brandos.test';

export async function createTestApp() {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return {
    app,
    prisma: app.get(PrismaService).client,
    mail: app.get(MailService),
  };
}

let counter = 0;
export function uniqueEmail(label = 'user'): string {
  counter += 1;
  return `${label}-${Date.now()}-${counter}@${TEST_DOMAIN}`;
}

export const STRONG_PASSWORD = 'Cotonou-Marché-2026!';

/** Inscrit un utilisateur et renvoie son cookie de session. */
export async function registerUser(app: INestApplication, email = uniqueEmail(), name = 'Aïcha Test') {
  const res = await request(app.getHttpServer())
    .post(`${API}/auth/register`)
    .send({ name, email, password: STRONG_PASSWORD })
    .expect(201);
  return { cookie: sessionCookie(res), user: res.body.user as { id: string; email: string } };
}

/** En-tête Set-Cookie complet de la session (avec ses attributs). */
export function sessionCookieHeader(res: request.Response): string {
  const header = res.headers['set-cookie'] as string[] | string | undefined;
  const raw = Array.isArray(header) ? header : header ? [header] : [];
  const cookie = raw.find((c) => c.startsWith('session='));
  if (!cookie) throw new Error('Aucun cookie de session');
  return cookie;
}

/** Valeur à renvoyer dans l'en-tête Cookie. */
export function sessionCookie(res: request.Response): string {
  return sessionCookieHeader(res).split(';')[0]!;
}

/** Extrait le jeton du dernier lien envoyé à cette adresse. */
export function lastTokenSentTo(mail: MailService, email: string): string {
  const message = [...mail.outbox].reverse().find((m) => m.to === email);
  const token = message?.text.match(/token=([\w-]+)/)?.[1];
  if (!token) throw new Error(`Aucun lien envoyé à ${email}`);
  return token;
}

/** Supprime les comptes de test et leurs organisations. */
export async function cleanup(prisma: Awaited<ReturnType<typeof createTestApp>>['prisma']) {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${TEST_DOMAIN}` } },
    select: { id: true, memberships: { select: { organizationId: true } } },
  });
  const orgIds = users.flatMap((u) => u.memberships.map((m) => m.organizationId));
  await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
}
