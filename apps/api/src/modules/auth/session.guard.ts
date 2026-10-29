import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC } from '../../common/request-context.js';
import { SessionService } from './session.service.js';

/** Garde globale : toute route exige une session valide, sauf @Public(). */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const token: unknown = req.cookies?.[this.sessions.cookieName];
    const session = typeof token === 'string' ? await this.sessions.resolve(token) : null;
    if (!session) throw new UnauthorizedException('Veuillez vous connecter.');

    req.auth = {
      userId: session.userId,
      sessionId: session.id,
      emailVerified: session.user.emailVerifiedAt !== null,
    };
    return true;
  }
}
