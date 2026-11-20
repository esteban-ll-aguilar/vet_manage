import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import configuration from '../../src/config/configuration.js';
import { GlobalExceptionFilter } from '../../src/common/errors/global-exception.filter.js';
import { InventoryModule } from '../../src/modules/inventory/inventory.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { AccessService } from '../../src/modules/identity/services/access.service.js';
import { TokenService } from '../../src/modules/identity/services/token.service.js';

const DOG_FOOD = '123e4567-e89b-12d3-a456-426614174000';
const MISSING = '123e4567-e89b-12d3-a456-426614174999';

type Batch = {
  id: string;
  productId: string;
  code: string;
  expirationDate: Date;
  initialQuantity: number;
  availableQuantity: number;
};

describe('POST /inventory/batches (HU-02, e2e)', () => {
  let app: INestApplication;
  let permissions: Set<string>;
  let batches: Batch[];
  let products: Array<{ id: string; code: string; name: string; stock: number; isActive: boolean }>;

  const tokens = { verify: vi.fn(async () => 'user-1') };
  const access = {
    findActiveUser: vi.fn(async () => ({ id: 'user-1' })),
    getPermissionKeys: vi.fn(async () => permissions),
  };

  // Base de datos en memoria con la misma forma que usa InventoryService.
  const tx = {
    product: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; isActive: boolean } }) =>
        products.find((p) => p.id === where.id && p.isActive) ?? null),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { stock: { increment: number } } }) => {
        const product = products.find((p) => p.id === where.id)!;
        product.stock += data.stock.increment;
        return { id: product.id, code: product.code, name: product.name, stock: product.stock };
      }),
    },
    batch: {
      create: vi.fn(async ({ data }: { data: Omit<Batch, 'id'> }) => {
        const batch = { id: `batch-${batches.length + 1}`, ...data, createdAt: new Date(), updatedAt: new Date() };
        batches.push(batch);
        return batch;
      }),
    },
  };
  const prisma = { $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)) };

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
    batches = [];
    products = [{ id: DOG_FOOD, code: 'PR-001', name: 'Alimento para perro', stock: 10, isActive: true }];
    permissions = new Set(['inventory:register-entry']);
  });

  afterAll(async () => {
    await app?.close();
  });

  const valid = { productId: DOG_FOOD, code: 'L-2026-001', expirationDate: '2027-10-23', initialQuantity: 50 };
  const post = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/inventory/batches').set('Authorization', 'Bearer t').send(body);

  const expectNothingSaved = () => {
    expect(batches).toHaveLength(0);
    expect(products[0].stock).toBe(10);
  };

  it('escenario 1: registra el lote y aumenta el stock en 50 unidades (201)', async () => {
    const res = await post(valid).expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Entrada de lote registrada correctamente');
    expect(res.body.data.batch).toMatchObject({
      code: 'L-2026-001', expirationDate: '2027-10-23', initialQuantity: 50, availableQuantity: 50, productId: DOG_FOOD,
    });
    expect(res.body.data.product).toMatchObject({ id: DOG_FOOD, stock: 60 });
    expect(batches).toHaveLength(1);
    expect(products[0].stock).toBe(60);
  });

  it('escenario 2: sin producto no registra nada (400)', async () => {
    const res = await post({ ...valid, productId: '' }).expect(400);

    expect(res.body.message).toBe('Debe seleccionar un producto');
    expectNothingSaved();
  });

  it('escenario 3: sin código de lote no registra nada (400)', async () => {
    const res = await post({ ...valid, code: '' }).expect(400);

    expect(res.body.message).toBe('Debe ingresar el código del lote');
    expectNothingSaved();
  });

  it('escenario 4: sin fecha de caducidad no registra nada (400)', async () => {
    const res = await post({ ...valid, expirationDate: '' }).expect(400);

    expect(res.body.message).toBe('Debe ingresar la fecha de caducidad');
    expectNothingSaved();
  });

  it('escenario 5: sin cantidad inicial no registra nada (400)', async () => {
    const { initialQuantity: _omitted, ...withoutQuantity } = valid;
    const res = await post(withoutQuantity).expect(400);

    expect(res.body.message).toBe('Debe ingresar la cantidad inicial');
    expectNothingSaved();
  });

  it.each([0, -5])('escenarios 6 y 7: rechaza la cantidad %s (400)', async (initialQuantity) => {
    const res = await post({ ...valid, initialQuantity }).expect(400);

    expect(res.body.message).toBe('La cantidad inicial debe ser mayor que cero');
    expectNothingSaved();
  });

  it.each([2.5, 'abc'])('escenario 8: rechaza la cantidad %s (400)', async (initialQuantity) => {
    const res = await post({ ...valid, initialQuantity }).expect(400);

    expect(res.body.message).toBe('La cantidad inicial debe ser un número entero mayor que cero');
    expectNothingSaved();
  });

  it('rechaza un producto inexistente sin modificar existencias (404)', async () => {
    const res = await post({ ...valid, productId: MISSING }).expect(404);

    expect(res.body.message).toBe('El producto seleccionado no existe');
    expectNothingSaved();
  });

  it('requiere sesión (401)', async () => {
    await request(app.getHttpServer()).post('/inventory/batches').send(valid).expect(401);
    expectNothingSaved();
  });

  it('requiere el permiso inventory:register-entry (403)', async () => {
    permissions = new Set(['inventory:read']);

    await post(valid).expect(403);
    expectNothingSaved();
  });
});
