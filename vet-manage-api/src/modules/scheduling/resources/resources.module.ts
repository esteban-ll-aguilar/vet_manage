
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../infrastructure/database/prisma/prisma.module.js';
import { IdentityModule } from '../../identity/identity.module.js';
import { BranchesModule } from '../branches/branches.module.js';
import { ResourcesController } from './routes/resources.controller.js';
import { ResourcesRepository } from './repositories/resources.repository.js';
import { ResourcesService } from './services/resources.service.js';

@Module({
  imports: [PrismaModule, IdentityModule, BranchesModule],
  controllers: [ResourcesController],
  providers: [ResourcesService, ResourcesRepository],
})
export class ResourcesModule {}
