import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  deleteAccountSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  tokenSchema,
  type DeleteAccountInput,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
  type TokenInput,
} from '@brand-os/shared';
import type { Request, Response } from 'express';
import { CurrentAuth, Public, type AuthContext } from '../../common/request-context.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { AuthService } from './auth.service.js';
import { SessionService, type ClientInfo } from './session.service.js';

/** Limite stricte sur les routes exposées aux attaques par force brute. */
const STRICT = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Public()
  @Throttle(STRICT)
  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, session } = await this.auth.register(body, clientInfo(req));
    this.sessions.setCookie(res, session.token, session.expiresAt);
    return { user };
  }

  @Public()
  @Throttle(STRICT)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, session } = await this.auth.login(body, clientInfo(req));
    this.sessions.setCookie(res, session.token, session.expiresAt);
    return { user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentAuth() auth: AuthContext, @Res({ passthrough: true }) res: Response) {
    await this.sessions.revoke(auth.userId, auth.sessionId);
    this.sessions.clearCookie(res);
  }

  @Get('me')
  async me(@CurrentAuth() auth: AuthContext) {
    return { user: await this.auth.me(auth.userId) };
  }

  @Public()
  @Throttle(STRICT)
  @Post('verify-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  async verifyEmail(@Body(new ZodValidationPipe(tokenSchema)) body: TokenInput) {
    await this.auth.verifyEmail(body.token);
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('resend-verification')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resendVerification(@CurrentAuth() auth: AuthContext) {
    await this.auth.resendVerification(auth.userId);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async forgotPassword(@Body(new ZodValidationPipe(forgotPasswordSchema)) body: ForgotPasswordInput) {
    await this.auth.forgotPassword(body);
  }

  @Public()
  @Throttle(STRICT)
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(@Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordInput) {
    await this.auth.resetPassword(body);
  }

  // US-04
  @Get('sessions')
  async listSessions(@CurrentAuth() auth: AuthContext) {
    const sessions = await this.sessions.listActive(auth.userId);
    return { sessions: sessions.map((s) => ({ ...s, current: s.id === auth.sessionId })) };
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!(await this.sessions.revoke(auth.userId, id))) {
      throw new NotFoundException('Session introuvable.');
    }
    if (id === auth.sessionId) this.sessions.clearCookie(res);
  }

  // US-07
  @Throttle(STRICT)
  @Post('delete-account')
  async deleteAccount(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(deleteAccountSchema)) body: DeleteAccountInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.requestDeletion(auth.userId, body);
    this.sessions.clearCookie(res);
    return result;
  }
}

function clientInfo(req: Request): ClientInfo {
  return { userAgent: req.get('user-agent'), ipAddress: req.ip };
}
