import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../infrastructure/database/prisma/prisma.module.js';
import { IdentityModule } from '../../identity/identity.module.js';
import { SaturdayShiftsController } from './routes/saturday-shifts.controller.js';
import { SaturdayShiftRepository } from './repositories/saturday-shift.repository.js';
import { SaturdayShiftService } from './services/saturday-shift.service.js';

// Turnos de sábado por sucursal.
@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [SaturdayShiftsController],
  providers: [SaturdayShiftRepository, SaturdayShiftService],
})
export class SaturdayShiftsModule {}
