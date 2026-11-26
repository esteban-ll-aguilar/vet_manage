import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobalExceptionFilter } from '../../src/common/errors/global-exception.filter.js';
import configuration from '../../src/config/configuration.js';
import { InventoryModule } from '../../src/modules/inventory/inventory.module.js';
import { AccessService } from '../../src/modules/identity/services/access.service.js';
import { TokenService } from '../../src/modules/identity/services/token.service.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';

type BatchFixture = {
  id: string;
  code: string;
  expirationDate: Date;
  availableQuantity: number;
  product: { name: string };
};

describe('GET /inventory/expiration-alerts (HU-12, e2e)', () => {
  let app: INestApplication;
  let permissions: Set<string>;
  let batches: BatchFixture[];

  const tokens = { verify: vi.fn(async () => 'user-1') };
  const access = {
    findActiveUser: vi.fn(async () => ({ id: 'user-1' })),
    getPermissionKeys: vi.fn(async () => permissions),
  };
  const prisma = {
    batch: {
      findMany: vi.fn(async ({ where }: {
        where: { availableQuantity: { gt: number }; expirationDate: { lte: Date } };
      }) => batches.filter((batch) => batch.availableQuantity > where.availableQuantity.gt
        && batch.expirationDate <= where.expirationDate.lte)),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { expirationDate: Date } }) => {
        const batch = batches.find((item) => item.id === where.id);
        if (!batch) throw { code: 'P2025' };
        batch.expirationDate = data.expirationDate;
        return batch;
      }),
    },
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/vet_manage';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'secret-for-testing-only-at-least-32-chars-long';
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, load: [configuration] }), InventoryModule],
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
    permissions = new Set(['inventory:read', 'inventory:register-entry']);
    batches = [];
  });

  afterAll(async () => {
    await app?.close();
  });

  function utcDayOffset(days: number) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days));
  }

  function batch(id: string, daysToExpiry: number, availableQuantity: number): BatchFixture {
    return {
      id,
      code: `LOTE-${id}`,
      expirationDate: utcDayOffset(daysToExpiry),
      availableQuantity,
      product: { name: `Producto ${id}` },
    };
  }

  function getAlerts() {
    return request(app.getHttpServer()).get('/inventory/expiration-alerts').set('Authorization', 'Bearer t');
  }

  function updateExpiration(id: string, expirationDate: string) {
    return request(app.getHttpServer())
      .patch(`/inventory/batches/${id}/expiration-date`)
      .set('Authorization', 'Bearer t')
      .send({ expirationDate });
  }

  it('muestra lotes vencidos, de hoy y dentro de 30 días; excluye 31 días y cero unidades', async () => {
    batches = [
      batch('30-DIAS', 30, 10),
      batch('HOY', 0, 4),
      batch('VENCIDO', -1, 5),
      batch('31-DIAS', 31, 10),
      batch('SIN-STOCK', 5, 0),
    ];

    const response = await getAlerts().expect(200);
    const alerts = response.body.data;

    expect(alerts).toHaveLength(3);
    expect(alerts.find((item: { lotId: string }) => item.lotId === '30-DIAS')).toMatchObject({
      productName: 'Producto 30-DIAS',
      lotCode: 'LOTE-30-DIAS',
      availableQuantity: 10,
      label: 'Próximo a caducar',
    });
    expect(alerts.find((item: { lotId: string }) => item.lotId === 'HOY').label).toBe('Próximo a caducar');
    expect(alerts.find((item: { lotId: string }) => item.lotId === 'VENCIDO').label).toBe('Caducado');
    expect(alerts.some((item: { lotId: string }) => item.lotId === '31-DIAS' || item.lotId === 'SIN-STOCK')).toBe(false);
    expect(prisma.batch.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ availableQuantity: { gt: 0 } }),
    }));
  });

  it('devuelve lista vacía cuando ningún lote cumple las condiciones', async () => {
    batches = [batch('31-DIAS', 31, 10), batch('SIN-STOCK', 5, 0)];

    const response = await getAlerts().expect(200);

    expect(response.body.data).toEqual([]);
  });

  it('retira la alerta después de guardar una fecha de caducidad a 45 días', async () => {
    batches = [batch('ACTUALIZADO', 5, 8)];
    expect((await getAlerts().expect(200)).body.data).toHaveLength(1);

    const newDate = utcDayOffset(45).toISOString().slice(0, 10);
    const response = await updateExpiration('ACTUALIZADO', newDate).expect(200);
    expect(response.body.data.expirationDate).toBe(newDate);
    expect((await getAlerts().expect(200)).body.data).toEqual([]);
  });

  it('requiere sesión y el permiso inventory:read', async () => {
    await request(app.getHttpServer()).get('/inventory/expiration-alerts').expect(401);

    permissions = new Set(['inventory:register-entry']);
    await getAlerts().expect(403);

    permissions = new Set(['inventory:read']);
    await updateExpiration('missing', '2027-01-03').expect(403);
  });
});
