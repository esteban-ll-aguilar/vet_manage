import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { success } from '../../../../common/errors/api-response.js';
import { RequirePermissions } from '../../../identity/decorators/require-permissions.decorator.js';
import { CreateRateDto } from '../dtos/create-rate.dto.js';
import { UpdateRateDto } from '../dtos/update-rate.dto.js';
import { RatesService } from '../services/rates.service.js';

@Controller('scheduling/rates')
export class RatesController {
  constructor(private readonly rates: RatesService) {}

  @Get()
  @RequirePermissions('rates:read')
  async list(@Query('servicioId') servicioId?: string, @Query('sucursalId') sucursalId?: string) {
    return success(await this.rates.list(servicioId, sucursalId), 'Catálogo de tarifas');
  }

  @Get('services')
  @RequirePermissions('rates:read')
  async listServices() {
    return success(await this.rates.listServices(), 'Catálogo de servicios');
  }

  @Post()
  @RequirePermissions('rates:manage')
  async create(@Body() dto: CreateRateDto) {
    return success(await this.rates.save(dto), 'Tarifa registrada correctamente');
  }

  @Patch(':id')
  @RequirePermissions('rates:manage')
  async update(@Param('id') id: string, @Body() dto: UpdateRateDto) {
    return success(await this.rates.update(id, dto), 'Tarifa actualizada correctamente');
  }

  @Patch('services/:id/deactivate')
  @RequirePermissions('rates:manage')
  async deactivateService(@Param('id') id: string) {
    return success(await this.rates.deactivateService(id), 'Servicio inactivado correctamente');
  }

  @Patch('services/:id/activate')
  @RequirePermissions('rates:manage')
  async activateService(@Param('id') id: string) {
    return success(await this.rates.activateService(id), 'Servicio activado correctamente');
  }
}
