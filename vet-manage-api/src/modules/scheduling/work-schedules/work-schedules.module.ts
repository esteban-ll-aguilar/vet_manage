import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../infrastructure/database/prisma/prisma.module.js';
import { IdentityModule } from '../../identity/identity.module.js';
import { WorkScheduleRepository } from './repositories/work-schedule.repository.js';
import { ListWorkSchedulesService } from './services/list-work-schedules.service.js';
import { CreateWorkScheduleService } from './services/create-work-schedule.service.js';
import { UpdateWorkScheduleService } from './services/update-work-schedule.service.js';
import { DeleteWorkScheduleService } from './services/delete-work-schedule.service.js';
import { WorkSchedulesController } from './routes/work-schedules.controller.js';

// Horarios base de atención de cada veterinario.
@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [WorkSchedulesController],
  providers: [
    WorkScheduleRepository,
    ListWorkSchedulesService,
    CreateWorkScheduleService,
    UpdateWorkScheduleService,
    DeleteWorkScheduleService,
  ],
})
export class WorkSchedulesModule {}
