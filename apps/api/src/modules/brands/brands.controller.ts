import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import {
  brandBriefSchema,
  brandIdentitySchema,
  generateSchema,
  type BrandBrief,
  type BrandIdentityInput,
  type GenerateInput,
} from '@brand-os/shared';
import { CurrentTenant, RequirePermission, type TenantContext } from '../../common/request-context.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { TenantGuard } from '../organizations/tenant.guard.js';
import { BrandsService } from './brands.service.js';

@ApiTags('brands')
@ApiHeader({ name: 'X-Organization-Id', required: true })
@Controller('brands')
@UseGuards(TenantGuard)
export class BrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Get()
  @RequirePermission('brandKit.view')
  async list(@CurrentTenant() tenant: TenantContext) {
    return { brands: await this.brands.list(tenant) };
  }

  @Post()
  @RequirePermission('brand.edit')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(brandBriefSchema)) brief: BrandBrief,
  ) {
    return { brand: await this.brands.create(tenant, brief) };
  }

  @Get(':id')
  @RequirePermission('brandKit.view')
  async get(@CurrentTenant() tenant: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return { brand: await this.brands.get(tenant, id) };
  }

  @Put(':id/brief')
  @RequirePermission('brand.edit')
  async updateBrief(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(brandBriefSchema)) brief: BrandBrief,
  ) {
    return { brand: await this.brands.updateBrief(tenant, id, brief) };
  }

  // US-21 ; synchrone tant que l'analyse est faite par règles. Avec un modèle de
  // langage, passera par la file BullMQ et renverra un identifiant de tâche (§7.3).
  @Post(':id/generate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('brand.edit')
  async generate(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(generateSchema)) body: GenerateInput,
  ) {
    return this.brands.generate(tenant, id, body.attempt);
  }

  @Post(':id/palettes/generate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('brand.edit')
  async generatePalettes(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(generateSchema)) body: GenerateInput,
  ) {
    return { palettes: await this.brands.generatePalettes(tenant, id, body.attempt) };
  }

  @Put(':id/identity')
  @RequirePermission('brand.edit')
  async saveIdentity(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(brandIdentitySchema)) body: BrandIdentityInput,
  ) {
    return { brand: await this.brands.saveIdentity(tenant, id, body) };
  }
}
