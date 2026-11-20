import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../infrastructure/database/prisma/prisma.module.js';
import { IdentityModule } from '../../identity/identity.module.js';

// Consulta de veterinarios y consultorios disponibles.
@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [],
  providers: [],
})
export class ResourcesModule {}
