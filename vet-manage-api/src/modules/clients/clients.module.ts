import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { ClientsController } from './routes/clients.controller.js';
import { ClientsRepository } from './repositories/clients.repository.js';
import { ClientsService } from './services/clients.service.js';

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [ClientsController],
  providers: [ClientsRepository, ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
