import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { UsageModule } from '../usage/usage.module.js';
import { BrandsController } from './brands.controller.js';
import { BrandsService } from './brands.service.js';

@Module({
  imports: [AiModule, UsageModule, OrganizationsModule],
  controllers: [BrandsController],
  providers: [BrandsService],
})
export class BrandsModule {}
