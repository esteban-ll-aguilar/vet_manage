import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { success } from '../../../../common/errors/api-response.js';
import { RequirePermissions } from '../../../identity/decorators/require-permissions.decorator.js';
import { GenerateSaturdayShiftsDto, SubstituteSaturdayShiftDto } from '../dtos/saturday-shift.dto.js';
import { SaturdayShiftService } from '../services/saturday-shift.service.js';

@Controller('scheduling')
export class SaturdayShiftsController {
  constructor(private readonly service: SaturdayShiftService) {}

  @Get('saturday-shifts')
  @RequirePermissions('saturday-shifts:read')
  async list(
    @Query('sucursalId') sucursalId?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
  ) {
    return success(await this.service.list(sucursalId, fechaDesde, fechaHasta), 'Turnos de sábado');
  }

  @Post('saturday-shifts/generate')
  @RequirePermissions('saturday-shifts:manage')
  async generate(@Body() dto: GenerateSaturdayShiftsDto) {
    return success(await this.service.generate(dto), 'Turnos de sábado generados');
  }

  @Put('saturday-shifts/:id')
  @RequirePermissions('saturday-shifts:manage')
  async substitute(@Param('id') id: string, @Body() dto: SubstituteSaturdayShiftDto) {
    return success(await this.service.substitute(id, dto), 'Turno sustituido');
  }
}
