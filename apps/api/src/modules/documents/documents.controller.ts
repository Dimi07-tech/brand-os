import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import {
  clientInputSchema,
  createDocumentSchema,
  documentDraftSchema,
  productInputSchema,
  type ClientInput,
  type CreateDocumentInput,
  type DocumentDraftInput,
  type ProductInput,
} from '@brand-os/shared';
import { CurrentTenant, RequirePermission, type TenantContext } from '../../common/request-context.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { TenantGuard } from '../organizations/tenant.guard.js';
import { CatalogService } from './catalog.service.js';
import { DocumentsService } from './documents.service.js';

const DOCUMENT_TYPES = ['INVOICE', 'QUOTE', 'CREDIT_NOTE'] as const;

/**
 * Factures et devis — §4.8. Réservés aux rôles qui peuvent les créer (matrice §4.2 :
 * Propriétaire, Administrateur, Comptable) : ce sont des données financières.
 */
@ApiTags('documents')
@ApiHeader({ name: 'X-Organization-Id', required: true })
@Controller('documents')
@UseGuards(TenantGuard)
@RequirePermission('document.create')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  async list(@CurrentTenant() tenant: TenantContext, @Query('type') type?: string) {
    const filter = DOCUMENT_TYPES.find((t) => t === type);
    return { documents: await this.documents.list(tenant, { type: filter }) };
  }

  @Post()
  async create(@CurrentTenant() tenant: TenantContext, @Body(new ZodValidationPipe(createDocumentSchema)) body: CreateDocumentInput) {
    return { document: await this.documents.create(tenant, body) };
  }

  @Get(':id')
  async get(@CurrentTenant() tenant: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return { document: await this.documents.get(tenant, id) };
  }

  @Put(':id')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(documentDraftSchema)) body: DocumentDraftInput,
  ) {
    return { document: await this.documents.update(tenant, id, body) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentTenant() tenant: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.documents.remove(tenant, id);
  }

  @Post(':id/issue')
  @HttpCode(HttpStatus.OK)
  async issue(@CurrentTenant() tenant: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return { document: await this.documents.issue(tenant, id) };
  }

  @Post(':id/credit-note')
  async creditNote(@CurrentTenant() tenant: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return { document: await this.documents.creditNote(tenant, id) };
  }

  @Post(':id/duplicate')
  async duplicate(@CurrentTenant() tenant: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return { document: await this.documents.duplicate(tenant, id) };
  }
}

@ApiTags('documents')
@ApiHeader({ name: 'X-Organization-Id', required: true })
@Controller('clients')
@UseGuards(TenantGuard)
@RequirePermission('document.create')
export class ClientsController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  async list(@CurrentTenant() tenant: TenantContext, @Query('q') q?: string) {
    return { clients: await this.catalog.listClients(tenant, q?.slice(0, 100)) };
  }

  @Post()
  async create(@CurrentTenant() tenant: TenantContext, @Body(new ZodValidationPipe(clientInputSchema)) body: ClientInput) {
    return { client: await this.catalog.createClient(tenant, body) };
  }

  @Put(':id')
  async update(@CurrentTenant() tenant: TenantContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(clientInputSchema)) body: ClientInput) {
    return { client: await this.catalog.updateClient(tenant, id, body) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentTenant() tenant: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.catalog.deleteClient(tenant, id);
  }
}

@ApiTags('documents')
@ApiHeader({ name: 'X-Organization-Id', required: true })
@Controller('products')
@UseGuards(TenantGuard)
@RequirePermission('document.create')
export class ProductsController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  async list(@CurrentTenant() tenant: TenantContext) {
    return { products: await this.catalog.listProducts(tenant) };
  }

  @Post()
  async create(@CurrentTenant() tenant: TenantContext, @Body(new ZodValidationPipe(productInputSchema)) body: ProductInput) {
    return { product: await this.catalog.createProduct(tenant, body) };
  }

  @Put(':id')
  async update(@CurrentTenant() tenant: TenantContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(productInputSchema)) body: ProductInput) {
    return { product: await this.catalog.updateProduct(tenant, id, body) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentTenant() tenant: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.catalog.deleteProduct(tenant, id);
  }
}
