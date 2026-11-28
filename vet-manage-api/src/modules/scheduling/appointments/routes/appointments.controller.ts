import { ListAppointmentsService } from '../services/list-appointments.service.js';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiException } from '../../../../common/errors/api-exception.js';
import { success } from '../../../../common/errors/api-response.js';
import { RequirePermissions } from '../../../identity/decorators/require-permissions.decorator.js';
import type { AuthenticatedRequest } from '../../../identity/types/authenticated-request.js';
import { RegisterAppointmentDto } from '../dtos/register-appointment.dto.js';
import { RegisterAppointmentService } from '../services/register-appointment.service.js';
import { CancelAppointmentDto } from '../dtos/cancel-appointment.dto.js';
import { CancelAppointmentService } from '../services/cancel-appointment.service.js';

@Controller('scheduling/appointments')
export class AppointmentsController {
  constructor(
    private readonly registerAppointment: RegisterAppointmentService,
    private readonly cancelService: CancelAppointmentService,
    private readonly listService: ListAppointmentsService,
  ) {}

  @Get()
  @RequirePermissions('appointments:read')
  async list() {
    return success(
      await this.listService.execute(),
      'Citas consultadas correctamente',
    );
  }

  @Patch(':id/cancel')
  @RequirePermissions('appointments:cancel')
  async cancel(
    @Param('id') id: string,
    @Body() input: CancelAppointmentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.user) {
      throw ApiException.unauthorized();
    }

    const appointment = await this.cancelService.execute(
      id,
      input.motivo,
      request.user.id,
    );

    return success(
      appointment,
      'Cita cancelada correctamente',
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('appointments:create')
  async register(
    @Body() dto: RegisterAppointmentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.user) throw ApiException.unauthorized();
    const appointment = await this.registerAppointment.register(dto, request.user.id);
    return success(appointment, 'Cita registrada', HttpStatus.CREATED);
  }
}
