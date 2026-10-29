import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { UsageModule } from '../usage/usage.module.js';
import { CatalogService } from './catalog.service.js';
import { ClientsController, DocumentsController, ProductsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';

@Module({
  imports: [OrganizationsModule, UsageModule],
  controllers: [DocumentsController, ClientsController, ProductsController],
  providers: [DocumentsService, CatalogService],
})
export class DocumentsModule {}
