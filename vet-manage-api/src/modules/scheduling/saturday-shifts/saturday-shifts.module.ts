import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../infrastructure/database/prisma/prisma.module.js';
import { IdentityModule } from '../../identity/identity.module.js';

// Turnos de sábado por sucursal.
@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [],
  providers: [],
})
export class SaturdayShiftsModule {}
