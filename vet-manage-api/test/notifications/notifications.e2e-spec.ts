import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobalExceptionFilter } from '../../src/common/errors/global-exception.filter.js';
import configuration from '../../src/config/configuration.js';
import { NotificationsModule } from '../../src/modules/notifications/notifications.module.js';
import { AccessService } from '../../src/modules/identity/services/access.service.js';
import { TokenService } from '../../src/modules/identity/services/token.service.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '99999999-9999-4999-8999-999999999999';
const NOTIFICATION_ID = '22222222-2222-4222-8222-222222222222';
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

describe('Notifications API (HU-30, e2e)', () => {
  let app: INestApplication;
  let permissions: Set<string>;
  let notifications: StoredNotification[];
  let products: Array<{ id: string; isActive: boolean }>;

  const tokens = { verify: vi.fn(async () => USER_ID) };
  const access = {
    findActiveUser: vi.fn(async () => ({ id: USER_ID })),
    getPermissionKeys: vi.fn(async () => permissions),
  };

  const prisma = {
    notification: {
      findMany: vi.fn(async ({ where, take }: { where: { userId: string; leida?: boolean }; take: number }) =>
        notifications
          .filter((item) => item.userId === where.userId && (where.leida === undefined || item.leida === where.leida))
          .slice(0, take)),
      count: vi.fn(async ({ where }: { where: { userId: string; leida: boolean } }) =>
        notifications.filter((item) => item.userId === where.userId && item.leida === where.leida).length),
      updateMany: vi.fn(async ({ where, data }: {
        where: { id: string; userId: string; leida: boolean };
        data: { leida: boolean; fechaLectura: Date };
      }) => {
        const matches = notifications.filter((item) =>
          item.id === where.id && item.userId === where.userId && item.leida === where.leida);
        matches.forEach((item) => Object.assign(item, data));
        return { count: matches.length };
      }),
      findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string } }) =>
        notifications.find((item) => item.id === where.id && item.userId === where.userId) ?? null),
    },
    product: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; isActive: boolean } }) =>
        products.find((item) => item.id === where.id && item.isActive) ?? null),
    },
    batch: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === BATCH_ID ? { id: BATCH_ID } : null),
    },
    category: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; isActive: boolean } }) =>
        where.id === CATEGORY_ID && where.isActive ? { id: CATEGORY_ID } : null),
    },
    marca: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; isActive: boolean } }) =>
        where.id === BRAND_ID && where.isActive ? { id: BRAND_ID } : null),
    },
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/vet_manage';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'secret-for-testing-only-at-least-32-chars-long';
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, load: [configuration] }), NotificationsModule],
    })
      .overrideProvider(PrismaService).useValue(prisma)
      .overrideProvider(TokenService).useValue(tokens)
      .overrideProvider(AccessService).useValue(access)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    permissions = new Set(['inventory:read']);
    notifications = [];
    products = [{ id: PRODUCT_ID, isActive: true }];
  });

  afterAll(async () => {
    await app?.close();
  });

  const get = (path: string) => request(app.getHttpServer()).get(path).set('Authorization', 'Bearer t');

  it('returns only the authenticated user notifications', async () => {
    notifications = [
      notification(),
      notification({ id: '44444444-4444-4444-8444-444444444444', titulo: 'Lote por vencer', tipoEntidad: 'BATCH', entidadId: BATCH_ID }),
      notification({ id: '88888888-8888-4888-8888-888888888888', userId: OTHER_USER_ID }),
    ];

    const response = await get('/notifications').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0]).toMatchObject({
      titulo: 'Stock bajo',
      fechaEmitida: '2026-11-19T10:00:00.000Z',
      leida: false,
      tipoEntidad: 'PRODUCT',
      entidadId: PRODUCT_ID,
    });
    expect(response.body.data.some((item: { id: string }) => item.id === '88888888-8888-4888-8888-888888888888')).toBe(false);
  });

  it('returns an empty list when the user has no notifications', async () => {
    const response = await get('/notifications').expect(200);
    expect(response.body.data).toEqual([]);
  });

  it('returns the unread count', async () => {
    notifications = [notification(), notification({ id: '44444444-4444-4444-8444-444444444444', leida: true })];

    const response = await get('/notifications/unread-count').expect(200);

    expect(response.body.data).toEqual({ unreadCount: 1 });
  });

  it('marks a notification as read and keeps it in the history', async () => {
    notifications = [notification()];

    const first = await request(app.getHttpServer())
      .patch(`/notifications/${NOTIFICATION_ID}/read`)
      .set('Authorization', 'Bearer t')
      .expect(200);
    const second = await request(app.getHttpServer())
      .patch(`/notifications/${NOTIFICATION_ID}/read`)
      .set('Authorization', 'Bearer t')
      .expect(200);

    expect(first.body.data.leida).toBe(true);
    expect(first.body.data.fechaLectura).not.toBeNull();
    expect(second.body.data.fechaLectura).toBe(first.body.data.fechaLectura);
    expect((await get('/notifications').expect(200)).body.data).toHaveLength(1);
  });

  it('resolves the related record when the user has permission', async () => {
    notifications = [notification()];

    const response = await get(`/notifications/${NOTIFICATION_ID}/related-record`).expect(200);

    expect(response.body.data).toEqual({
      tipoEntidad: 'PRODUCT',
      entidadId: PRODUCT_ID,
      route: `/inventory/products/${PRODUCT_ID}`,
    });
  });

  it('blocks the related record with 403 when the user lacks the permission', async () => {
    notifications = [notification()];
    permissions = new Set();

    const response = await get(`/notifications/${NOTIFICATION_ID}/related-record`).expect(403);

    expect(response.body.message).toContain('permisos');
    expect(response.body.data).toBeUndefined();
  });

  it('does not reveal another user notification', async () => {
    notifications = [notification({ userId: OTHER_USER_ID })];

    await get(`/notifications/${NOTIFICATION_ID}/related-record`).expect(404);
    await request(app.getHttpServer())
      .patch(`/notifications/${NOTIFICATION_ID}/read`)
      .set('Authorization', 'Bearer t')
      .expect(404);
  });

  it('rejects unsupported entity types', async () => {
    notifications = [notification({ tipoEntidad: 'UNKNOWN' })];

    const response = await get(`/notifications/${NOTIFICATION_ID}/related-record`).expect(400);
    expect(response.body.code).toBe('UNSUPPORTED_ENTITY_TYPE');
  });

  it('reports a missing related record', async () => {
    notifications = [notification()];
    products = [];

    const response = await get(`/notifications/${NOTIFICATION_ID}/related-record`).expect(404);
    expect(response.body.code).toBe('RELATED_ENTITY_NOT_FOUND');
  });

  it('rejects malformed identifiers', async () => {
    const response = await request(app.getHttpServer())
      .patch('/notifications/not-a-uuid/read')
      .set('Authorization', 'Bearer t')
      .expect(400);
    expect(response.body.code).toBe('INVALID_NOTIFICATION_ID');
  });

  it('requires a session and inventory:read permission', async () => {
    await request(app.getHttpServer()).get('/notifications').expect(401);

    permissions = new Set();
    await get('/notifications').expect(403);
    await get('/notifications/unread-count').expect(403);
    await request(app.getHttpServer())
      .patch(`/notifications/${NOTIFICATION_ID}/read`)
      .set('Authorization', 'Bearer t')
      .expect(403);
  });
});
