import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiException } from '../../../common/errors/api-exception.js';
import { success } from '../../../common/errors/api-response.js';
import { RequirePermissions } from '../../identity/decorators/require-permissions.decorator.js';
import { JwtAuthGuard } from '../../identity/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../identity/guards/permissions.guard.js';
import type { AuthenticatedRequest } from '../../identity/types/authenticated-request.js';
import { ChangeSpeciesStatusDto } from '../dtos/species/change-species-status.dto.js';
import { RegisterSpeciesDto } from '../dtos/species/register-species.dto.js';
import { UpdateSpeciesDto } from '../dtos/species/update-species.dto.js';
import { SpeciesRepository } from '../repositories/species.repository.js';
import { ChangeSpeciesStatusService } from '../services/species/change-species-status.service.js';
import { ListActiveSpeciesService } from '../services/species/list-active-species.service.js';
import { RegisterSpeciesService } from '../services/species/register-species.service.js';
import { UpdateSpeciesService } from '../services/species/update-species.service.js';

@Controller('pets')
export class SpeciesController {
  constructor(
    private readonly registerSpeciesService: RegisterSpeciesService,
    private readonly listActiveSpeciesService: ListActiveSpeciesService,
    private readonly updateSpeciesService: UpdateSpeciesService,
    private readonly speciesRepository: SpeciesRepository,
    private readonly changeSpeciesStatusService: ChangeSpeciesStatusService,
  ) {}

  @Get('species')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('species:read')
  async listSpecies() {
    return success(await this.speciesRepository.findAll(), 'Especies consultadas correctamente');
  }

  @Post('species')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('species:create')
  async registerSpecies(@Body() dto: RegisterSpeciesDto, @Req() request: AuthenticatedRequest) {
    if (!request.user) throw ApiException.unauthorized();
    const created = await this.registerSpeciesService.execute(dto, request.user.id);
    return success(created, 'Especie registrada exitosamente', 201);
  }

  @Patch('species/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('species:update')
  async updateSpecies(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSpeciesDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.user) throw ApiException.unauthorized();
    const updated = await this.updateSpeciesService.execute(id, dto, request.user.id);
    return success(updated, 'Especie actualizada exitosamente');
  }

  // Activa o inactiva una especie (HU-15); solo el Veterinario tiene species:change-status.
  @Patch('species/:id/status')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('species:change-status')
  async changeSpeciesStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeSpeciesStatusDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.user) throw ApiException.unauthorized();
    const { message, species } = await this.changeSpeciesStatusService.execute(id, dto.isActive, request.user.id);
    return success(species, message);
  }

  @Get('species/active')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('species:read')
  async listActiveSpecies() {
    return success(await this.listActiveSpeciesService.execute(), 'Especies activas');
  }
}
