import { BullModule } from '@nestjs/bullmq';
import { Module, type DynamicModule, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { UsageModule } from '../usage/usage.module.js';
import { ExportRunner } from './export-runner.js';
import { DocumentPreviewController, ExportsController, GuidelinesController } from './exports.controller.js';
import { ExportsProcessor } from './exports.processor.js';
import { EXPORTS_QUEUE, ExportsService } from './exports.service.js';
import { FontLibrary } from './font-library.js';
import { PdfRenderer } from './pdf-renderer.js';
import { PrintPdfService } from './print-pdf.js';

/** Connexion Redis de BullMQ à partir de REDIS_URL. */
function redisConnection(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username || undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db: parsed.pathname.length > 1 ? Number(parsed.pathname.slice(1)) : undefined,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
  };
}

@Module({})
export class ExportsModule implements OnModuleInit {
  constructor(private readonly fonts: FontLibrary) {}

  /**
   * @param options.workers traiter les exports dans ce processus (API en développement,
   * ou processus worker dédié en production : dist/worker.js).
   */
  static register(options: { workers: boolean }): DynamicModule {
    return {
      module: ExportsModule,
      imports: [
        BullModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService<Env, true>) => ({
            connection: redisConnection(config.get('REDIS_URL', { infer: true })),
            prefix: config.get('QUEUE_PREFIX', { infer: true }),
          }),
        }),
        BullModule.registerQueue({ name: EXPORTS_QUEUE }),
        UsageModule,
        OrganizationsModule,
      ],
      controllers: [ExportsController, GuidelinesController, DocumentPreviewController],
      providers: [
        ExportsService,
        ExportRunner,
        FontLibrary,
        PdfRenderer,
        PrintPdfService,
        ...(options.workers ? [ExportsProcessor] : []),
      ],
    };
  }

  /** Échoue au démarrage si une police du catalogue manque, plutôt qu'au premier export. */
  onModuleInit(): void {
    this.fonts.assertCatalog();
  }
}
