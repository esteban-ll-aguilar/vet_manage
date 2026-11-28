import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common';
import { ApiException } from '../../../../common/errors/api-exception.js';
import { success } from '../../../../common/errors/api-response.js';
import { RequirePermissions } from '../../../identity/decorators/require-permissions.decorator.js';
import type { AuthenticatedRequest } from '../../../identity/types/authenticated-request.js';
import { ModifyAppointmentDto } from '../dtos/modify-appointment.dto.js';
import { ModifyAppointmentService } from '../services/modify-appointment.service.js';

@Controller('scheduling/appointments')
export class AppointmentModificationController {
  constructor(private readonly modifyService: ModifyAppointmentService) {}

  @Get(':id')
  @RequirePermissions('appointments:update')
  async detail(@Param('id') id: string) {
    return success(await this.modifyService.getDetail(id), 'Cita consultada correctamente');
  }

  @Patch(':id')
  @RequirePermissions('appointments:update')
  async modify(
    @Param('id') id: string,
    @Body() input: ModifyAppointmentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.user) throw ApiException.unauthorized();

    const appointment = await this.modifyService.execute(id, input, request.user.id);
    return success(appointment, 'Cita modificada correctamente');
  }
}
