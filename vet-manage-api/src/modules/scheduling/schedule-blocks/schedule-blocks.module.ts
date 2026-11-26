import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../infrastructure/database/prisma/prisma.module.js';
import { IdentityModule } from '../../identity/identity.module.js';
import { ScheduleBlockRepository } from './repositories/schedule-block.repository.js';
import { ScheduleBlocksController } from './routes/schedule-blocks.controller.js';
import { ListScheduleBlocksService } from './services/list-schedule-blocks.service.js';
import { RegisterScheduleBlockService } from './services/register-schedule-block.service.js';
import { RemoveScheduleBlockService } from './services/remove-schedule-block.service.js';

// Registro y eliminación de bloqueos de horario.
@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [ScheduleBlocksController],
  providers: [ScheduleBlockRepository, RegisterScheduleBlockService, ListScheduleBlocksService, RemoveScheduleBlockService],
})
export class ScheduleBlocksModule {}
