import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../infrastructure/database/prisma/prisma.module.js';
import { IdentityModule } from '../../identity/identity.module.js';

// Horarios base de atención de cada veterinario.
@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [],
  providers: [],
})
export class WorkSchedulesModule {}
