import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import { FilesController } from './files.controller.js';
import { LocalStorageService, S3StorageService, StorageService } from './storage.service.js';

@Global()
@Module({
  controllers: [FilesController],
  providers: [
    {
      provide: StorageService,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        config.get('STORAGE_DRIVER', { infer: true }) === 's3' ? new S3StorageService(config) : new LocalStorageService(config),
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
