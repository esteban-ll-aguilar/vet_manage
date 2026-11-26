import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiException } from '../../../common/errors/api-exception.js';
import { NotificationsService } from './notifications.service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '99999999-9999-4999-8999-999999999999';
const NOTIFICATION_ID = '22222222-2222-4222-8222-222222222222';
const SECOND_NOTIFICATION_ID = '44444444-4444-4444-8444-444444444444';
const PRODUCT_ID = '33333333-3333-4333-8333-333333333333';
const BATCH_ID = '55555555-5555-4555-8555-555555555555';
const CATEGORY_ID = '66666666-6666-4666-8666-666666666666';
const BRAND_ID = '77777777-7777-4777-8777-777777777777';

type StoredNotification = ReturnType<typeof notification>;

function notification(overrides: Record<string, unknown> = {}) {
  return {
    id: NOTIFICATION_ID,
    userId: USER_ID,
    typeId: 'type-1',
    tipoEntidad: 'PRODUCT',
    entidadId: PRODUCT_ID,
    titulo: 'Stock bajo',
    mensaje: 'El producto está por debajo del mínimo',
    detalle: 'Quedan 3 unidades',
    prioridad: 'ALTA',
    fechaEmitida: new Date('2026-11-19T10:00:00.000Z'),
    fechaLectura: null as Date | null,
    leida: false,
    createdAt: new Date('2026-11-19T10:00:00.000Z'),
    updatedAt: new Date('2026-11-19T10:00:00.000Z'),
    type: { code: 'LOW_STOCK', name: 'Stock bajo' },
    ...overrides,
  };
}

function createPrismaMock() {
  const state = {
    notifications: [] as StoredNotification[],
    products: [{ id: PRODUCT_ID, isActive: true }],
    batches: [{ id: BATCH_ID }],
    categories: [{ id: CATEGORY_ID, isActive: true }],
    brands: [{ id: BRAND_ID, isActive: true }],
  };

  const prisma = {
    notification: {
      findMany: vi.fn(async ({ where, take }: { where: { userId: string; leida?: boolean }; take: number }) =>
        state.notifications
          .filter((item) => item.userId === where.userId && (where.leida === undefined || item.leida === where.leida))
          .slice(0, take)),
      count: vi.fn(async ({ where }: { where: { userId: string; leida: boolean } }) =>
        state.notifications.filter((item) => item.userId === where.userId && item.leida === where.leida).length),
      updateMany: vi.fn(async ({ where, data }: {
        where: { id: string; userId: string; leida: boolean };
        data: { leida: boolean; fechaLectura: Date };
      }) => {
        const matches = state.notifications.filter((item) =>
          item.id === where.id && item.userId === where.userId && item.leida === where.leida);
        matches.forEach((item) => Object.assign(item, data));
        return { count: matches.length };
      }),
      findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string } }) =>
        state.notifications.find((item) => item.id === where.id && item.userId === where.userId) ?? null),
    },
    product: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; isActive: boolean } }) =>
        state.products.find((item) => item.id === where.id && item.isActive) ?? null),
    },
    batch: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        state.batches.find((item) => item.id === where.id) ?? null),
    },
    category: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; isActive: boolean } }) =>
        state.categories.find((item) => item.id === where.id && item.isActive) ?? null),
    },
    marca: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; isActive: boolean } }) =>
        state.brands.find((item) => item.id === where.id && item.isActive) ?? null),
    },
  };

  return { prisma, state };
}

describe('NotificationsService', () => {
  let permissions: Set<string>;
  let access: { getPermissionKeys: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    permissions = new Set(['inventory:read']);
    access = { getPermissionKeys: vi.fn(async () => permissions) };
  });

  function createService() {
    const { prisma, state } = createPrismaMock();
    return { service: new NotificationsService(prisma as never, access as never), prisma, state };
  }

  it('lists only the authenticated user notifications with title, date, read state and related record', async () => {
    const { service, state } = createService();
    state.notifications = [
      notification(),
      notification({ id: SECOND_NOTIFICATION_ID, titulo: 'Lote por vencer', tipoEntidad: 'BATCH', entidadId: BATCH_ID }),
      notification({ id: '88888888-8888-4888-8888-888888888888', userId: OTHER_USER_ID }),
    ];

    const result = await service.list(USER_ID);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: NOTIFICATION_ID,
      titulo: 'Stock bajo',
      leida: false,
      tipoEntidad: 'PRODUCT',
      entidadId: PRODUCT_ID,
      fechaEmitida: '2026-11-19T10:00:00.000Z',
      type: { code: 'LOW_STOCK', name: 'Stock bajo' },
    });
    expect(result.some((item) => item.id === '88888888-8888-4888-8888-888888888888')).toBe(false);
  });

  it('returns an empty list when the user has no notifications', async () => {
    const { service } = createService();

    await expect(service.list(USER_ID)).resolves.toEqual([]);
  });

  it('returns the unread count for the authenticated user', async () => {
    const { service, state } = createService();
    state.notifications = [notification(), notification({ id: SECOND_NOTIFICATION_ID, leida: true })];

    await expect(service.getUnreadCount(USER_ID)).resolves.toEqual({ unreadCount: 1 });
  });

  it('marks an unread notification as read and keeps it in the history', async () => {
    const { service, state } = createService();
    state.notifications = [notification()];

    const result = await service.markAsRead(USER_ID, NOTIFICATION_ID);

    expect(result.leida).toBe(true);
    expect(result.fechaLectura).not.toBeNull();
    expect(state.notifications[0]).toMatchObject({ leida: true });
    await expect(service.list(USER_ID)).resolves.toHaveLength(1);
  });

  it('keeps the original read date when marking an already read notification again', async () => {
    const { service, state } = createService();
    const readAt = new Date('2026-11-18T08:00:00.000Z');
    state.notifications = [notification({ leida: true, fechaLectura: readAt })];

    const result = await service.markAsRead(USER_ID, NOTIFICATION_ID);

    expect(result.leida).toBe(true);
    expect(result.fechaLectura).toBe(readAt.toISOString());
    expect(state.notifications[0].fechaLectura).toBe(readAt);
  });

  it('does not reveal another user notification', async () => {
    const { service, state } = createService();
    state.notifications = [notification({ userId: OTHER_USER_ID })];

    await expect(service.markAsRead(USER_ID, NOTIFICATION_ID)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.resolveRelatedRecord(USER_ID, NOTIFICATION_ID)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('resolves a product related record when the user has permission', async () => {
    const { service, state } = createService();
    state.notifications = [notification()];

    await expect(service.resolveRelatedRecord(USER_ID, NOTIFICATION_ID)).resolves.toEqual({
      tipoEntidad: 'PRODUCT',
      entidadId: PRODUCT_ID,
      route: `/inventory/products/${PRODUCT_ID}`,
    });
  });

  it('resolves category and brand routes from the allowlist', async () => {
    const { service, state } = createService();
    state.notifications = [
      notification({ tipoEntidad: 'CATEGORY', entidadId: CATEGORY_ID }),
    ];

    await expect(service.resolveRelatedRecord(USER_ID, NOTIFICATION_ID)).resolves.toMatchObject({
      route: '/inventory/categories',
    });

    state.notifications = [notification({ tipoEntidad: 'BRAND', entidadId: BRAND_ID })];
    await expect(service.resolveRelatedRecord(USER_ID, NOTIFICATION_ID)).resolves.toMatchObject({
      route: '/inventory/brands',
    });
  });

  it('blocks the related record when the user lacks the required permission', async () => {
    const { service, state } = createService();
    state.notifications = [notification()];
    permissions = new Set();

    await expect(service.resolveRelatedRecord(USER_ID, NOTIFICATION_ID)).rejects.toMatchObject({
      statusCode: 403,
      code: 'INSUFFICIENT_PERMISSIONS',
    });
  });

  it('rejects unsupported entity types without exposing a route', async () => {
    const { service, state } = createService();
    state.notifications = [notification({ tipoEntidad: 'UNKNOWN' })];

    await expect(service.resolveRelatedRecord(USER_ID, NOTIFICATION_ID)).rejects.toMatchObject({
      statusCode: 400,
      code: 'UNSUPPORTED_ENTITY_TYPE',
    });
  });

  it('reports a missing related record while keeping the notification in history', async () => {
    const { service, state } = createService();
    state.notifications = [notification()];
    state.products = [];

    await expect(service.resolveRelatedRecord(USER_ID, NOTIFICATION_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: 'RELATED_ENTITY_NOT_FOUND',
    });
    await expect(service.list(USER_ID)).resolves.toHaveLength(1);
  });

  it('rejects malformed notification identifiers', async () => {
    const { service } = createService();

    await expect(service.markAsRead(USER_ID, 'not-a-uuid')).rejects.toBeInstanceOf(ApiException);
    await expect(service.markAsRead(USER_ID, 'not-a-uuid')).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_NOTIFICATION_ID',
    });
  });
});
