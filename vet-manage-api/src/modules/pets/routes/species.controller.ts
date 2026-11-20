import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiException } from '../../../common/errors/api-exception.js';
import { success } from '../../../common/errors/api-response.js';
import { JwtAuthGuard } from '../../identity/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../identity/guards/permissions.guard.js';
import { RequirePermissions } from '../../identity/decorators/require-permissions.decorator.js';
import type { AuthenticatedRequest } from '../../identity/types/authenticated-request.js';
import { RegisterSpeciesDto } from '../dtos/species/register-species.dto.js';
import { ListActiveSpeciesService } from '../services/species/list-active-species.service.js';
import { RegisterSpeciesService } from '../services/species/register-species.service.js';

@Controller('pets')
export class SpeciesController {
  constructor(
    private readonly registerSpeciesService: RegisterSpeciesService,
    private readonly listActiveSpeciesService: ListActiveSpeciesService,
  ) {}

  @Post('species')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('species:create')
  async registerSpecies(@Body() dto: RegisterSpeciesDto, @Req() request: AuthenticatedRequest) {
    if (!request.user) throw ApiException.unauthorized();
    const created = await this.registerSpeciesService.execute(dto, request.user.id);
    return success(created, 'Especie registrada exitosamente', 201);
  }

  @Get('species/active')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('species:read')
  async listActiveSpecies() {
    return success(await this.listActiveSpeciesService.execute(), 'Especies activas');
  }
}
