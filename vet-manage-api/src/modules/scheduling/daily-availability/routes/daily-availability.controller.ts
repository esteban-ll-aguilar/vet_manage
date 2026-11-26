import { Body, Controller, Delete, Get, Put, Query, Req } from '@nestjs/common';
import { ApiException } from '../../../../common/errors/api-exception.js';
import { success } from '../../../../common/errors/api-response.js';
import { RequirePermissions } from '../../../identity/decorators/require-permissions.decorator.js';
import type { AuthenticatedRequest } from '../../../identity/types/authenticated-request.js';
import { SaveDailyAvailabilityDto } from '../dtos/daily-availability.dto.js';
import { DailyAvailabilityService } from '../services/daily-availability.service.js';

@Controller('scheduling/daily-availability')
export class DailyAvailabilityController {
  constructor(private readonly service: DailyAvailabilityService) {}

  // Disponibilidad propia de una fecha: las jornadas autorizadas y sus franjas.
  @Get('me')
  @RequirePermissions('daily-availability:manage-own')
  async mine(@Query('fecha') fecha: string, @Req() request: AuthenticatedRequest) {
    if (!request.user) throw ApiException.unauthorized();
    return success(await this.service.getMine(request.user.id, fecha), 'Disponibilidad diaria');
  }

  // Registra o modifica las franjas propias de una fecha. El veterinario sale de la sesión.
  @Put('me')
  @RequirePermissions('daily-availability:manage-own')
  async save(@Body() dto: SaveDailyAvailabilityDto, @Req() request: AuthenticatedRequest) {
    if (!request.user) throw ApiException.unauthorized();
    return success(await this.service.saveMine(request.user.id, dto), 'Disponibilidad actualizada');
  }

  // Elimina las franjas de la fecha y vuelve a usar la jornada completa.
  @Delete('me')
  @RequirePermissions('daily-availability:manage-own')
  async reset(
    @Query('fecha') fecha: string | undefined,
    @Query('horarioBaseId') horarioBaseId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.user) throw ApiException.unauthorized();
    return success(
      await this.service.resetMine(request.user.id, fecha, horarioBaseId),
      'Jornada restablecida',
    );
  }
}
