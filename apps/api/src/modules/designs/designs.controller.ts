import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { createDesignSchema, updateDesignSchema, type CreateDesignInput, type UpdateDesignInput } from '@brand-os/shared';
import { CurrentTenant, RequirePermission, type TenantContext } from '../../common/request-context.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { TenantGuard } from '../organizations/tenant.guard.js';
import { DesignsService } from './designs.service.js';

@ApiTags('designs')
@ApiHeader({ name: 'X-Organization-Id', required: true })
@Controller('designs')
@UseGuards(TenantGuard)
export class DesignsController {
  constructor(private readonly designs: DesignsService) {}

  @Get()
  @RequirePermission('brandKit.view')
  async list(@CurrentTenant() tenant: TenantContext) {
    return { designs: await this.designs.list(tenant) };
  }

  @Post()
  @RequirePermission('design.create')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(createDesignSchema)) body: CreateDesignInput,
  ) {
    return { design: await this.designs.create(tenant, body) };
  }

  @Get(':id')
  @RequirePermission('brandKit.view')
  async get(@CurrentTenant() tenant: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return { design: await this.designs.get(tenant, id) };
  }

  @Put(':id')
  @RequirePermission('design.create')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateDesignSchema)) body: UpdateDesignInput,
  ) {
    return { design: await this.designs.update(tenant, id, body) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('design.create')
  async remove(@CurrentTenant() tenant: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    await this.designs.remove(tenant, id);
  }
}
