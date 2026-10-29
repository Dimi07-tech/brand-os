import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.js';
import { HealthController } from './health/health.controller.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { AiModule } from './modules/ai/ai.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BrandAssetsModule } from './modules/brand-assets/brand-assets.module.js';
import { BrandsModule } from './modules/brands/brands.module.js';
import { DesignsModule } from './modules/designs/designs.module.js';
import { DocumentsModule } from './modules/documents/documents.module.js';
import { ExportsModule } from './modules/exports/exports.module.js';
import { MailModule } from './modules/mail/mail.module.js';
import { OrganizationsModule } from './modules/organizations/organizations.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { StorageModule } from './modules/storage/storage.module.js';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module.js';
import { TemplatesModule } from './modules/templates/templates.module.js';
import { UsageModule } from './modules/usage/usage.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env'],
      validate: validateEnv,
    }),
    // Limitation du débit par adresse IP (§9.1) ; stockage Redis à prévoir
    // dès qu'il y aura plusieurs instances de l'API.
    // Désactivée en test : les scénarios enchaînent les inscriptions depuis la même IP.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
    PrismaModule,
    MailModule,
    StorageModule,
    AuthModule,
    OrganizationsModule,
    BrandsModule,
    BrandAssetsModule,
    TemplatesModule,
    DesignsModule,
    DocumentsModule,
    // ConfigModule.forRoot() (plus haut) a déjà chargé le .env dans process.env.
    ExportsModule.register({ workers: process.env.WORKERS_ENABLED !== 'false' }),
    SubscriptionsModule,
    PaymentsModule,
    UsageModule,
    AiModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
