import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPrismaClient, type PrismaClient } from '@brand-os/db';
import type { Env } from '../config/env.js';

@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly client: PrismaClient;

  constructor(config: ConfigService<Env, true>) {
    this.client = createPrismaClient(config.get('DATABASE_URL', { infer: true }));
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
