import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { Env } from './config/env.js';

/** Configuration HTTP commune à main.ts et aux tests de bout en bout. */
export function configureApp(app: INestApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  // Le site relaie /api/v1 vers l'API : l'IP réelle du client (limitation du
  // débit, sessions) vient de X-Forwarded-For, accepté seulement depuis le relais local.
  (app as NestExpressApplication).set('trust proxy', 'loopback');
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: config.get('WEB_ORIGIN', { infer: true }), credentials: true });
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();
}
