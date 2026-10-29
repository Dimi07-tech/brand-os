import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { DesignsController } from './designs.controller.js';
import { DesignsService } from './designs.service.js';

@Module({
  imports: [OrganizationsModule],
  controllers: [DesignsController],
  providers: [DesignsService],
})
export class DesignsModule {}
