import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type TokenPurpose, type User } from '@brand-os/db';
import type {
  DeleteAccountInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from '@brand-os/shared';
import type { Env } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { PasswordService } from './password.service.js';
import { SessionService, type ClientInfo } from './session.service.js';
import { generateToken, hashToken } from './tokens.js';

const MINUTE = 60 * 1000;
// RG-02
const MAX_FAILED_LOGINS = 5;
const FAILED_LOGIN_WINDOW_MS = 15 * MINUTE;
const LOCK_DURATION_MS = 15 * MINUTE;
// RG-03
const RESET_TOKEN_TTL_MS = 30 * MINUTE;
const VERIFICATION_TOKEN_TTL_MS = 48 * 60 * MINUTE;
// RG-04
const DELETION_GRACE_DAYS = 30;

const INVALID_CREDENTIALS = 'E-mail ou mot de passe incorrect.';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  locale: string;
}

@Injectable()
export class AuthService {
  private readonly webOrigin: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly mail: MailService,
    config: ConfigService<Env, true>,
  ) {
    this.webOrigin = config.get('WEB_ORIGIN', { infer: true });
  }

  // US-01, US-02
  async register(input: RegisterInput, client: ClientInfo) {
    const passwordHash = await this.passwords.hashNew(input.password);
    let user: User;
    try {
      user = await this.prisma.client.user.create({
        data: { email: input.email, name: input.name, passwordHash },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Un compte existe déjà avec cette adresse e-mail.');
      }
      throw err;
    }
    await this.sendVerificationEmail(user);
    const session = await this.sessions.create(user.id, client);
    return { user: toPublicUser(user), session };
  }

  async login(input: LoginInput, client: ClientInfo) {
    const user = await this.prisma.client.user.findUnique({ where: { email: input.email } });
    const now = Date.now();

    if (user?.lockedUntil && user.lockedUntil.getTime() > now) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - now) / MINUTE);
      throw new HttpException(
        `Trop de tentatives. Réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const valid = await this.passwords.verify(user?.passwordHash ?? null, input.password);
    if (!user) throw new UnauthorizedException(INVALID_CREDENTIALS);
    if (!valid) {
      await this.recordFailedLogin(user, now);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    // Une connexion pendant le délai de rétractation annule la suppression (RG-04).
    const updated = await this.prisma.client.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lastFailedLoginAt: null,
        lockedUntil: null,
        ...(user.status === 'PENDING_DELETION' && {
          deletionRequestedAt: null,
          status: user.emailVerifiedAt ? 'ACTIVE' : 'PENDING_VERIFICATION',
        }),
      },
    });
    const session = await this.sessions.create(user.id, client);
    return { user: toPublicUser(updated), session };
  }

  async me(userId: string) {
    const user = await this.prisma.client.user.findUniqueOrThrow({ where: { id: userId } });
    return toPublicUser(user);
  }

  // US-02
  async verifyEmail(token: string): Promise<void> {
    const record = await this.consumeToken(token, 'EMAIL_VERIFICATION');
    await this.prisma.client.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date(), status: 'ACTIVE' },
    });
  }

  async resendVerification(userId: string): Promise<void> {
    const user = await this.prisma.client.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.emailVerifiedAt) return;
    await this.sendVerificationEmail(user);
  }

  // US-03 : la réponse est identique que le compte existe ou non.
  async forgotPassword(input: ForgotPasswordInput): Promise<void> {
    const user = await this.prisma.client.user.findUnique({ where: { email: input.email } });
    if (!user || user.status === 'PENDING_DELETION') return;
    const token = await this.issueToken(user.id, 'PASSWORD_RESET', RESET_TOKEN_TTL_MS);
    const link = `${this.webOrigin}/reinitialiser-mot-de-passe?token=${token}`;
    await this.mail.send({
      to: user.email,
      subject: 'Réinitialisez votre mot de passe Brand OS',
      text:
        `Bonjour ${user.name},\n\nPour choisir un nouveau mot de passe, ouvrez ce lien :\n${link}\n\n` +
        `Il est valable 30 minutes et ne sert qu'une fois. Si vous n'êtes pas à l'origine de ` +
        `cette demande, ignorez cet e-mail : votre mot de passe reste inchangé.`,
      html:
        `<p>Bonjour ${escapeHtml(user.name)},</p><p>Pour choisir un nouveau mot de passe, ` +
        `<a href="${link}">cliquez ici</a>.</p><p>Ce lien est valable 30 minutes et ne sert ` +
        `qu'une fois. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>`,
    });
  }

  // RG-03 : lien à usage unique ; toutes les sessions sont fermées par sécurité.
  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const passwordHash = await this.passwords.hashNew(input.password);
    const record = await this.consumeToken(input.token, 'PASSWORD_RESET');
    await this.prisma.client.user.update({
      where: { id: record.userId },
      data: { passwordHash, failedLoginAttempts: 0, lastFailedLoginAt: null, lockedUntil: null },
    });
    await this.sessions.revokeAll(record.userId);
  }

  // US-07, RG-04 : suppression effective après 30 jours (tâche de purge).
  async requestDeletion(userId: string, input: DeleteAccountInput) {
    const user = await this.prisma.client.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await this.passwords.verify(user.passwordHash, input.password))) {
      throw new UnauthorizedException('Mot de passe incorrect.');
    }
    const requestedAt = new Date();
    await this.prisma.client.user.update({
      where: { id: userId },
      data: { status: 'PENDING_DELETION', deletionRequestedAt: requestedAt },
    });
    await this.sessions.revokeAll(userId);
    const effectiveAt = new Date(requestedAt.getTime() + DELETION_GRACE_DAYS * 24 * 60 * MINUTE);
    await this.mail.send({
      to: user.email,
      subject: 'Suppression de votre compte Brand OS',
      text:
        `Bonjour ${user.name},\n\nVotre compte sera supprimé définitivement le ` +
        `${effectiveAt.toLocaleDateString('fr-FR')}. Pour annuler, il suffit de vous reconnecter d'ici là.`,
      html:
        `<p>Bonjour ${escapeHtml(user.name)},</p><p>Votre compte sera supprimé définitivement le ` +
        `${effectiveAt.toLocaleDateString('fr-FR')}. Pour annuler, il suffit de vous reconnecter d'ici là.</p>`,
    });
    return { effectiveAt };
  }

  private async recordFailedLogin(user: User, now: number): Promise<void> {
    const inWindow =
      user.lastFailedLoginAt !== null && now - user.lastFailedLoginAt.getTime() < FAILED_LOGIN_WINDOW_MS;
    const attempts = inWindow ? user.failedLoginAttempts + 1 : 1;
    await this.prisma.client.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts >= MAX_FAILED_LOGINS ? 0 : attempts,
        lastFailedLoginAt: new Date(now),
        lockedUntil: attempts >= MAX_FAILED_LOGINS ? new Date(now + LOCK_DURATION_MS) : undefined,
      },
    });
  }

  private async sendVerificationEmail(user: User): Promise<void> {
    const token = await this.issueToken(user.id, 'EMAIL_VERIFICATION', VERIFICATION_TOKEN_TTL_MS);
    const link = `${this.webOrigin}/verifier-email?token=${token}`;
    await this.mail.send({
      to: user.email,
      subject: 'Confirmez votre adresse e-mail Brand OS',
      text: `Bonjour ${user.name},\n\nBienvenue sur Brand OS ! Confirmez votre adresse e-mail en ouvrant ce lien :\n${link}`,
      html:
        `<p>Bonjour ${escapeHtml(user.name)},</p><p>Bienvenue sur Brand OS ! ` +
        `<a href="${link}">Confirmez votre adresse e-mail</a>.</p>`,
    });
  }

  /** Invalide les jetons précédents du même usage, puis en émet un nouveau. */
  private async issueToken(userId: string, purpose: TokenPurpose, ttlMs: number): Promise<string> {
    const token = generateToken();
    await this.prisma.client.$transaction([
      this.prisma.client.verificationToken.updateMany({
        where: { userId, purpose, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.client.verificationToken.create({
        data: { userId, purpose, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttlMs) },
      }),
    ]);
    return token;
  }

  /** Consomme un jeton de façon atomique : deux requêtes simultanées ne peuvent pas l'utiliser. */
  private async consumeToken(token: string, purpose: TokenPurpose) {
    const tokenHash = hashToken(token);
    const { count } = await this.prisma.client.verificationToken.updateMany({
      where: { tokenHash, purpose, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (count !== 1) throw new BadRequestException('Ce lien est invalide ou a expiré.');
    return this.prisma.client.verificationToken.findUniqueOrThrow({ where: { tokenHash } });
  }
}

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerifiedAt !== null,
    locale: user.locale,
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
