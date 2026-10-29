import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Action, Role } from '@brand-os/shared';
import type { Request } from 'express';

export interface AuthContext {
  userId: string;
  sessionId: string;
  emailVerified: boolean;
}

export interface TenantContext {
  organizationId: string;
  userId: string;
  role: Role;
}

declare module 'express' {
  interface Request {
    auth?: AuthContext;
    tenant?: TenantContext;
  }
}

/** Route accessible sans session. */
export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Droit requis dans l'organisation active (matrice §4.2), vérifié par TenantGuard. */
export const REQUIRED_PERMISSION = 'requiredPermission';
export const RequirePermission = (action: Action) => SetMetadata(REQUIRED_PERMISSION, action);

export const CurrentAuth = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const auth = ctx.switchToHttp().getRequest<Request>().auth;
  if (!auth) throw new Error('CurrentAuth utilisé sur une route publique');
  return auth;
});

export const CurrentTenant = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const tenant = ctx.switchToHttp().getRequest<Request>().tenant;
  if (!tenant) throw new Error('CurrentTenant utilisé sans TenantGuard');
  return tenant;
});
