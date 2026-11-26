import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../infrastructure/database/prisma/prisma.module.js';
import { IdentityModule } from '../../identity/identity.module.js';
import { BranchRepository } from './repositories/branch.repository.js';
import { BranchesController } from './routes/branches.controller.js';
import { ListBranchesService } from './services/list-branches.service.js';

// Sucursales, salas y servicios: catálogos de consulta que usan todas las secciones de la agenda.
@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [BranchesController],
  providers: [BranchRepository, ListBranchesService],
  exports: [BranchRepository],
})
export class BranchesModule {}
