import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiException } from '../../../common/errors/api-exception.js';
import { success } from '../../../common/errors/api-response.js';
import { JwtAuthGuard } from '../../identity/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../identity/guards/permissions.guard.js';
import { RequirePermissions } from '../../identity/decorators/require-permissions.decorator.js';
import type { AuthenticatedRequest } from '../../identity/types/authenticated-request.js';
import { RegisterBreedDto } from '../dtos/breeds/register-breed.dto.js';
import { ListActiveBreedsService } from '../services/breeds/list-active-breeds.service.js';
import { RegisterBreedService } from '../services/breeds/register-breed.service.js';

@Controller('pets')
export class BreedController {
  constructor(
    private readonly registerBreedService: RegisterBreedService,
    private readonly listActiveBreedsService: ListActiveBreedsService,
  ) {}

  @Post('breeds')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  // Solo usuarios con permiso breeds:create pueden registrar razas
  @RequirePermissions('breeds:create')
  async registerBreed(@Body() dto: RegisterBreedDto, @Req() request: AuthenticatedRequest) {
    if (!request.user) throw ApiException.unauthorized();
    const created = await this.registerBreedService.execute(dto, request.user.id);
    return success(created, 'Raza registrada exitosamente', 201);
  }

  // Razas activas de una especie para el selector de pacientes (HU-07).
  @Get('species/:speciesId/breeds')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('breeds:read')
  async listActiveBreeds(@Param('speciesId', new ParseUUIDPipe()) speciesId: string) {
    return success(await this.listActiveBreedsService.execute(speciesId), 'Razas activas');
  }
}
