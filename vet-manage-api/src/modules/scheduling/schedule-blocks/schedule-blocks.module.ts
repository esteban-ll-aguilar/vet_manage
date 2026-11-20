import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../infrastructure/database/prisma/prisma.module.js';
import { IdentityModule } from '../../identity/identity.module.js';

// Registro y eliminación de bloqueos de horario.
@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [],
  providers: [],
})
export class ScheduleBlocksModule {}
