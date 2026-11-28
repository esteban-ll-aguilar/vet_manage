import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { success } from '../../../../common/errors/api-response.js';
import { RequirePermissions } from '../../../identity/decorators/require-permissions.decorator.js';
import {
  CalendarBranchDto,
  CalendarQueryDto,
} from '../dtos/calendar-query.dto.js';
import { CalendarService } from '../services/calendar.service.js';

@Controller('scheduling/calendar')
@RequirePermissions('calendar:read')
export class CalendarController {
  constructor(private readonly service: CalendarService) {}
  @Get('branches')
  async branches() {
    return success(await this.service.branches(), 'Sucursales del calendario');
  }
  @Get()
  async read(@Query() query: CalendarQueryDto) {
    return success(await this.service.read(query), 'Calendario consultado');
  }
  @Get('appointments/:id')
  async detail(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CalendarBranchDto,
  ) {
    return success(
      await this.service.detail(id, query.sucursalId),
      'Detalle de cita',
    );
  }
}
