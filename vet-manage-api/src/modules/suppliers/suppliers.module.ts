import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { SuppliersController } from './routes/suppliers.controller.js';
import { SuppliersRepository } from './repositories/suppliers.repository.js';
import { SuppliersService } from './services/suppliers.service.js';

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [SuppliersController],
  providers: [SuppliersRepository, SuppliersService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
