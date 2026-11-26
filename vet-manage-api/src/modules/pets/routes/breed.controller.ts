import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiException } from '../../../common/errors/api-exception.js';
import { success } from '../../../common/errors/api-response.js';
import { JwtAuthGuard } from '../../identity/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../identity/guards/permissions.guard.js';
import { RequirePermissions } from '../../identity/decorators/require-permissions.decorator.js';
import type { AuthenticatedRequest } from '../../identity/types/authenticated-request.js';
import { ListBreedsQueryDto } from '../dtos/breeds/list-breeds-query.dto.js';
import { RegisterBreedDto } from '../dtos/breeds/register-breed.dto.js';
import { UpdateBreedDto } from '../dtos/breeds/update-breed.dto.js';
import { ChangeBreedStatusService } from '../services/breeds/change-breed-status.service.js';
import { FindBreedsService } from '../services/breeds/find-breeds.service.js';
import { ListActiveBreedsService } from '../services/breeds/list-active-breeds.service.js';
import { RegisterBreedService } from '../services/breeds/register-breed.service.js';
import { UpdateBreedService } from '../services/breeds/update-breed.service.js';

@Controller('pets')
export class BreedController {
  constructor(
    private readonly registerBreedService: RegisterBreedService,
    private readonly listActiveBreedsService: ListActiveBreedsService,
    private readonly updateBreedService: UpdateBreedService,
    private readonly findBreedsService: FindBreedsService,
    private readonly changeBreedStatusService: ChangeBreedStatusService,
  ) {}

  // Listado con búsqueda por nombre y filtro por especie (HU-20). Sin filtros devuelve todas las razas.
  @Get('breeds')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('breeds:read')
  async listBreeds(@Query() query: ListBreedsQueryDto) {
    const { breeds, message } = await this.findBreedsService.list(query);
    return success(breeds, message);
  }

  // Detalle de una raza en solo lectura (HU-20).
  @Get('breeds/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('breeds:read')
  async getBreed(@Param('id', ParseUUIDPipe) id: string) {
    return success(await this.findBreedsService.findById(id), 'Raza consultada correctamente');
  }

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

  @Patch('breeds/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('breeds:update')
  async updateBreed(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBreedDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.user) throw ApiException.unauthorized();
    const updated = await this.updateBreedService.execute(id, dto, request.user.id);
    return success(updated, 'Raza actualizada exitosamente');
  }

  @Patch('breeds/:id/inactivate')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('breeds:change-status')
  async inactivateBreed(@Param('id', ParseUUIDPipe) id: string, @Req() request: AuthenticatedRequest) {
    if (!request.user) throw ApiException.unauthorized();
    const { message, breed } = await this.changeBreedStatusService.inactivate(id, request.user.id);
    return success(breed, message);
  }

  @Patch('breeds/:id/activate')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('breeds:change-status')
  async activateBreed(@Param('id', ParseUUIDPipe) id: string, @Req() request: AuthenticatedRequest) {
    if (!request.user) throw ApiException.unauthorized();
    const { message, breed } = await this.changeBreedStatusService.activate(id, request.user.id);
    return success(breed, message);
  }

  // Razas activas de una especie para el selector de pacientes (HU-07).
  @Get('species/:speciesId/breeds')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('breeds:read')
  async listActiveBreeds(@Param('speciesId', new ParseUUIDPipe()) speciesId: string) {
    return success(await this.listActiveBreedsService.execute(speciesId), 'Razas activas');
  }
}
