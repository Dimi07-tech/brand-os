import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import type { Env } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { generateToken, hashToken } from './tokens.js';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** lastSeenAt n'est rafraîchi qu'au-delà de ce délai, pour limiter les écritures. */
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export interface ClientInfo {
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class SessionService {
  /** En production, le préfixe __Host- impose Secure, Path=/ et l'absence de Domain. */
  readonly cookieName: string;
  private readonly secure: boolean;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.secure = config.get('NODE_ENV', { infer: true }) === 'production';
    this.cookieName = this.secure ? '__Host-session' : 'session';
  }

  async create(userId: string, client: ClientInfo): Promise<{ token: string; expiresAt: Date }> {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await this.prisma.client.session.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        expiresAt,
        userAgent: client.userAgent?.slice(0, 300),
        ipAddress: client.ipAddress,
      },
    });
    return { token, expiresAt };
  }

  /** Session valide correspondant au jeton du cookie, ou null. */
  async resolve(token: string) {
    const session = await this.prisma.client.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { select: { id: true, status: true, emailVerifiedAt: true } } },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;
    if (session.user.status === 'PENDING_DELETION') return null;

    if (Date.now() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.prisma.client.session.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() },
      });
    }
    return session;
  }

  async listActive(userId: string) {
    return this.prisma.client.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, userAgent: true, ipAddress: true, createdAt: true, lastSeenAt: true },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  /** Révoque une session de l'utilisateur ; renvoie false si elle n'est pas à lui. */
  async revoke(userId: string, sessionId: string): Promise<boolean> {
    const { count } = await this.prisma.client.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return count === 1;
  }

  async revokeAll(userId: string): Promise<void> {
    await this.prisma.client.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  setCookie(res: Response, token: string, expiresAt: Date): void {
    res.cookie(this.cookieName, token, { ...this.cookieOptions(), expires: expiresAt });
  }

  clearCookie(res: Response): void {
    res.clearCookie(this.cookieName, this.cookieOptions());
  }

  private cookieOptions(): CookieOptions {
    return { httpOnly: true, secure: this.secure, sameSite: 'lax', path: '/' };
  }
}
