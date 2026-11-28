import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../infrastructure/database/prisma/prisma.module.js';
import { IdentityModule } from '../../identity/identity.module.js';
import { CalendarController } from './routes/calendar.controller.js';
import { CalendarRepository } from './repositories/calendar.repository.js';
import { CalendarService } from './services/calendar.service.js';

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [CalendarController],
  providers: [CalendarRepository, CalendarService],
})
export class CalendarModule {}
