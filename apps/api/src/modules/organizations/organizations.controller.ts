import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  type CreateOrganizationInput,
  type UpdateOrganizationInput,
} from '@brand-os/shared';
import {
  CurrentAuth,
  CurrentTenant,
  RequirePermission,
  type AuthContext,
  type TenantContext,
} from '../../common/request-context.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { OrganizationsService } from './organizations.service.js';
import { TenantGuard } from './tenant.guard.js';

@ApiTags('organizations')
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Post()
  async create(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(createOrganizationSchema)) body: CreateOrganizationInput,
  ) {
    const organization = await this.organizations.create(auth.userId, body);
    return { organization: { ...organization, role: 'OWNER' } };
  }

  @Get()
  async listMine(@CurrentAuth() auth: AuthContext) {
    return { organizations: await this.organizations.listMine(auth.userId) };
  }

  @Get(':orgId')
  @UseGuards(TenantGuard)
  async get(@CurrentTenant() tenant: TenantContext) {
    return { organization: await this.organizations.get(tenant) };
  }

  @Patch(':orgId')
  @UseGuards(TenantGuard)
  @RequirePermission('organization.edit')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(updateOrganizationSchema)) body: UpdateOrganizationInput,
  ) {
    return { organization: await this.organizations.update(tenant, body) };
  }
}
