import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../infrastructure/database/prisma/prisma.module.js';
import { IdentityModule } from '../../identity/identity.module.js';
import { DailyAvailabilityRepository } from './repositories/daily-availability.repository.js';
import { DailyAvailabilityService } from './services/daily-availability.service.js';
import { DailyAvailabilityController } from './routes/daily-availability.controller.js';

// Disponibilidad diaria del veterinario.
@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [DailyAvailabilityController],
  providers: [DailyAvailabilityRepository, DailyAvailabilityService],
})
export class DailyAvailabilityModule {}
