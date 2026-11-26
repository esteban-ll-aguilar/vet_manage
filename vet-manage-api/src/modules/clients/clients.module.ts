import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { ClientsController } from './routes/clients.controller.js';
import { ClientsRepository } from './repositories/clients.repository.js';
import { ChangeClientStatusService } from './services/change-client-status.service.js';
import { ClientsService } from './services/clients.service.js';
import { UpdateClientService } from './services/update-client.service.js';

@Module({
  imports: [PrismaModule, IdentityModule, AuditModule],
  controllers: [ClientsController],
  providers: [ClientsRepository, ClientsService, ChangeClientStatusService, UpdateClientService],
  exports: [ClientsService],
})
export class ClientsModule {}
