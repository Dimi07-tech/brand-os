import { Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller.js';
import { OrganizationsService } from './organizations.service.js';
import { TenantGuard } from './tenant.guard.js';

@Module({
  controllers: [OrganizationsController],
  providers: [OrganizationsService, TenantGuard],
  exports: [TenantGuard],
})
export class OrganizationsModule {}
