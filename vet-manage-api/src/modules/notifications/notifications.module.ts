import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './services/notifications.service.js';

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
