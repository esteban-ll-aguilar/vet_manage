import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../infrastructure/database/prisma/prisma.module.js';
import { IdentityModule } from '../../identity/identity.module.js';
import { RateRepository } from './repositories/rate.repository.js';
import { RatesController } from './routes/rates.controller.js';
import { RatesService } from './services/rates.service.js';

// Catálogo de tarifas por servicio y sucursal.
@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [RatesController],
  providers: [RateRepository, RatesService],
  exports: [RatesService],
})
export class RatesModule {}
