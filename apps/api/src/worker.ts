import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { validateEnv } from './config/env.js';
import { ExportsModule } from './modules/exports/exports.module.js';
import { MailModule } from './modules/mail/mail.module.js';
import { StorageModule } from './modules/storage/storage.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

/**
 * Processus worker dédié aux tâches longues (§7) : en production, l'API tourne
 * avec WORKERS_ENABLED=false et un ou plusieurs workers lancés par `node dist/worker.js`.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env'], validate: validateEnv }),
    PrismaModule,
    MailModule,
    StorageModule,
    ExportsModule.register({ workers: true }),
  ],
})
class WorkerModule {}

const app = await NestFactory.createApplicationContext(WorkerModule);
app.enableShutdownHooks();
