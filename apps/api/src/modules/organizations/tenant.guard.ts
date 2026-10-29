import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { can, type Action } from '@brand-os/shared';
import type { Request } from 'express';
import { REQUIRED_PERMISSION } from '../../common/request-context.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Résout l'organisation active (paramètre de route `orgId`, sinon en-tête
 * X-Organization-Id), vérifie l'adhésion active et le droit requis (RG-10).
 * À placer après SessionGuard. Une organisation dont on n'est pas membre
 * répond 404, pour ne pas révéler son existence.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const auth = req.auth;
    if (!auth) throw new ForbiddenException();

    const raw = req.params.orgId ?? req.get('x-organization-id');
    const organizationId = typeof raw === 'string' ? raw : undefined;
    if (!organizationId || !UUID.test(organizationId)) {
      throw new NotFoundException('Organisation introuvable.');
    }

    const membership = await this.prisma.client.membership.findUnique({
      where: { userId_organizationId: { userId: auth.userId, organizationId } },
      select: { role: true, status: true },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new NotFoundException('Organisation introuvable.');
    }

    const required = this.reflector.getAllAndOverride<Action | undefined>(REQUIRED_PERMISSION, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required && !can(membership.role, required)) {
      throw new ForbiddenException("Votre rôle ne permet pas cette action.");
    }

    req.tenant = { organizationId, userId: auth.userId, role: membership.role };
    return true;
  }
}
