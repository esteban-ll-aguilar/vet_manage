import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { success } from '../../../../common/errors/api-response.js';
import { RequirePermissions } from '../../../identity/decorators/require-permissions.decorator.js';
import { ListWorkSchedulesService } from '../services/list-work-schedules.service.js';
import { CreateWorkScheduleService } from '../services/create-work-schedule.service.js';
import { UpdateWorkScheduleService } from '../services/update-work-schedule.service.js';
import { DeleteWorkScheduleService } from '../services/delete-work-schedule.service.js';
import { QueryWorkSchedulesDto } from '../dtos/query-work-schedules.dto.js';
import { CreateWorkScheduleDto } from '../dtos/create-work-schedule.dto.js';
import { UpdateWorkScheduleDto } from '../dtos/update-work-schedule.dto.js';

@Controller('scheduling')
export class WorkSchedulesController {
  constructor(
    private readonly listService: ListWorkSchedulesService,
    private readonly createService: CreateWorkScheduleService,
    private readonly updateService: UpdateWorkScheduleService,
    private readonly deleteService: DeleteWorkScheduleService,
  ) {}

  @Get('work-schedules')
  @RequirePermissions('work-schedules:read')
  async list(@Query() query: QueryWorkSchedulesDto) {
    return success(await this.listService.list(query), 'Horarios base');
  }

  @Get('work-schedules/veterinarians')
  @RequirePermissions('work-schedules:read')
  async listVeterinarians() {
    return success(await this.listService.listVeterinarians(), 'Veterinarios activos');
  }

  @Post('work-schedules')
  @RequirePermissions('work-schedules:manage')
  async create(@Body() dto: CreateWorkScheduleDto) {
    return success(await this.createService.create(dto), 'Horario creado');
  }

  @Put('work-schedules/:id')
  @RequirePermissions('work-schedules:manage')
  async update(@Param('id') id: string, @Body() dto: UpdateWorkScheduleDto) {
    return success(await this.updateService.update(id, dto), 'Horario actualizado');
  }

  @Delete('work-schedules/:id')
  @RequirePermissions('work-schedules:manage')
  async remove(@Param('id') id: string) {
    await this.deleteService.remove(id);
    return success(null, 'Horario eliminado');
  }
}
