import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../infrastructure/database/prisma/prisma.module.js';
import { IdentityModule } from '../../identity/identity.module.js';

// Disponibilidad diaria del veterinario.
@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [],
  providers: [],
})
export class DailyAvailabilityModule {}
