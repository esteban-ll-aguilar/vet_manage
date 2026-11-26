import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import configuration from './config/configuration.js';
import { validateEnvironment } from './config/env.validation.js';
import { HealthModule } from './health/health.module.js';
import { ClientsModule } from './modules/clients/clients.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { PetsModule } from './modules/pets/pets.module.js';
import { SchedulingModule } from './modules/scheduling/scheduling.module.js';
import { SuppliersModule } from './modules/suppliers/suppliers.module.js';
import { PrismaModule } from './infrastructure/database/prisma/prisma.module.js';
import { RabbitmqModule } from './infrastructure/rabbitmq/rabbitmq.module.js';
import { RedisModule } from './infrastructure/redis/redis.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnvironment,
    }),
    PrismaModule,
    RedisModule,
    RabbitmqModule,
    HealthModule,
    IdentityModule,
    ClientsModule,
    InventoryModule,
    NotificationsModule,
    PetsModule,
    SchedulingModule,
    SuppliersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
