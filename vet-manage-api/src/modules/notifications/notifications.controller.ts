import { Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import { success } from '../../common/errors/api-response.js';
import { RequirePermissions } from '../identity/decorators/require-permissions.decorator.js';
import type { AuthenticatedRequest } from '../identity/types/authenticated-request.js';
import { NotificationsService } from './services/notifications.service.js';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @RequirePermissions('inventory:read')
  async list(
    @Req() request: AuthenticatedRequest,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('take') take?: string,
  ) {
    return success(await this.notificationsService.list(request.user!.id, { unreadOnly, take }));
  }

  @Get('unread-count')
  @RequirePermissions('inventory:read')
  async unreadCount(@Req() request: AuthenticatedRequest) {
    return success(await this.notificationsService.getUnreadCount(request.user!.id));
  }

  @Patch(':id/read')
  @RequirePermissions('inventory:read')
  async markAsRead(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return success(
      await this.notificationsService.markAsRead(request.user!.id, id),
      'Notificación marcada como leída',
    );
  }

  @Get(':id/related-record')
  @RequirePermissions('inventory:read')
  async relatedRecord(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return success(await this.notificationsService.resolveRelatedRecord(request.user!.id, id));
  }
}
