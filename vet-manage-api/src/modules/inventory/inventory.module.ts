import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './services/inventory.service.js';

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [InventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}
