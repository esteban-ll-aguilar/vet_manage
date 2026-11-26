import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { ApiException } from '../../../common/errors/api-exception.js';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';
import { AccessService } from '../../identity/services/access.service.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const RELATED_ENTITY_PERMISSIONS = {
  PRODUCT: 'inventory:read',
  BATCH: 'inventory:read',
  CATEGORY: 'inventory:read',
  BRAND: 'inventory:read',
} as const;

type RelatedEntityType = keyof typeof RELATED_ENTITY_PERMISSIONS;

const RELATED_ENTITY_ROUTES: Record<RelatedEntityType, (id: string) => string> = {
  PRODUCT: (id) => `/inventory/products/${id}`,
  BATCH: (id) => `/inventory/batches/${id}`,
  CATEGORY: () => '/inventory/categories',
  BRAND: () => '/inventory/brands',
};

type NotificationWithType = Prisma.NotificationGetPayload<{
  include: { type: { select: { code: true; name: true } } };
}>;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async list(userId: string, options: { unreadOnly?: string; take?: string } = {}) {
    const notifications = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(options.unreadOnly === 'true' ? { leida: false } : {}),
      },
      include: { type: { select: { code: true, name: true } } },
      orderBy: { fechaEmitida: 'desc' },
      take: this.parseTake(options.take),
    });

    return notifications.map((notification) => this.serialize(notification));
  }

  async getUnreadCount(userId: string) {
    const unreadCount = await this.prisma.notification.count({ where: { userId, leida: false } });
    return { unreadCount };
  }

  async markAsRead(userId: string, id: string) {
    this.assertUuid(id);

    await this.prisma.notification.updateMany({
      where: { id, userId, leida: false },
      data: { leida: true, fechaLectura: new Date() },
    });

    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
      include: { type: { select: { code: true, name: true } } },
    });

    if (!notification) throw ApiException.notFound('Notificación no encontrada');
    return this.serialize(notification);
  }

  async resolveRelatedRecord(userId: string, id: string) {
    this.assertUuid(id);

    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
      select: { tipoEntidad: true, entidadId: true },
    });
    if (!notification) throw ApiException.notFound('Notificación no encontrada');

    const entityType = notification.tipoEntidad as RelatedEntityType;
    const permission = RELATED_ENTITY_PERMISSIONS[entityType];
    if (!permission) {
      throw new ApiException(
        'El registro relacionado no está disponible',
        400,
        [],
        'UNSUPPORTED_ENTITY_TYPE',
      );
    }

    const granted = await this.access.getPermissionKeys(userId);
    if (!granted.has(permission)) {
      throw new ApiException(
        'No tiene permisos suficientes para consultar el registro relacionado',
        403,
        [],
        'INSUFFICIENT_PERMISSIONS',
      );
    }

    const exists = await this.relatedEntityExists(entityType, notification.entidadId);
    if (!exists) {
      throw new ApiException(
        'El registro relacionado no está disponible',
        404,
        [],
        'RELATED_ENTITY_NOT_FOUND',
      );
    }

    return {
      tipoEntidad: entityType,
      entidadId: notification.entidadId,
      route: RELATED_ENTITY_ROUTES[entityType](notification.entidadId),
    };
  }

  private async relatedEntityExists(type: RelatedEntityType, id: string) {
    try {
      switch (type) {
        case 'PRODUCT':
          return Boolean(await this.prisma.product.findFirst({
            where: { id, isActive: true },
            select: { id: true },
          }));
        case 'BATCH':
          return Boolean(await this.prisma.batch.findUnique({
            where: { id },
            select: { id: true },
          }));
        case 'CATEGORY':
          return Boolean(await this.prisma.category.findFirst({
            where: { id, isActive: true },
            select: { id: true },
          }));
        case 'BRAND':
          return Boolean(await this.prisma.marca.findFirst({
            where: { id, isActive: true },
            select: { id: true },
          }));
      }
    } catch {
      return false;
    }
  }

  private parseTake(value?: string) {
    const parsed = Number(value);
    if (!value || !Number.isInteger(parsed) || parsed <= 0) return 50;
    return Math.min(parsed, 100);
  }

  private assertUuid(id: string) {
    if (!UUID_PATTERN.test(id)) {
      throw new ApiException('Identificador de notificación inválido', 400, [], 'INVALID_NOTIFICATION_ID');
    }
  }

  private serialize(notification: NotificationWithType) {
    return {
      id: notification.id,
      type: { code: notification.type.code, name: notification.type.name },
      tipoEntidad: notification.tipoEntidad,
      entidadId: notification.entidadId,
      titulo: notification.titulo,
      mensaje: notification.mensaje,
      detalle: notification.detalle,
      prioridad: notification.prioridad,
      fechaEmitida: notification.fechaEmitida.toISOString(),
      fechaLectura: notification.fechaLectura ? notification.fechaLectura.toISOString() : null,
      leida: notification.leida,
    };
  }
}
