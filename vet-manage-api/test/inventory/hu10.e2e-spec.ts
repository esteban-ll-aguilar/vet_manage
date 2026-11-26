import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobalExceptionFilter } from '../../src/common/errors/global-exception.filter.js';
import { ROLES } from '../../src/config/roles.catalog.js';
import { JwtAuthGuard } from '../../src/modules/identity/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../src/modules/identity/guards/permissions.guard.js';
import { AccessService } from '../../src/modules/identity/services/access.service.js';
import { TokenService } from '../../src/modules/identity/services/token.service.js';
import { InventoryController } from '../../src/modules/inventory/inventory.controller.js';
import { InventoryService } from '../../src/modules/inventory/services/inventory.service.js';

describe('HU-10: búsqueda y acceso HTTP', () => {
  let app: INestApplication;
  const inventory = {
    listProducts: vi.fn().mockResolvedValue([]),
    listCategories: vi.fn().mockResolvedValue([]),
    listBrands: vi.fn().mockResolvedValue([]),
  };
  const tokens = {
    verify: vi.fn(async (token: string) => ROLES.some((role) => role.name === token) ? token : null),
  };
  const access = {
    findActiveUser: vi.fn(async (id: string) => ({ id, personId: 'person-1' })),
    getPermissionKeys: vi.fn(async (id: string) => new Set(
      ROLES.find((role) => role.name === id)?.permissions ?? [],
    )),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        JwtAuthGuard,
        PermissionsGuard,
        { provide: InventoryService, useValue: inventory },
        { provide: TokenService, useValue: tokens },
        { provide: AccessService, useValue: access },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  beforeEach(() => vi.clearAllMocks());
  afterAll(async () => app?.close());

  it.each(['products', 'categories', 'brands'])(
    'exige autenticación para consultar %s',
    async (path) => {
      await request(app.getHttpServer()).get('/api/v1/inventory/' + path).expect(401);
      expect(inventory.listProducts).not.toHaveBeenCalled();
    },
  );

  it.each(['manager', 'warehouse_keeper', 'veterinarian', 'cashier', 'administrator'])(
    'permite al rol %s consultar productos y referencias de los filtros',
    async (role) => {
      for (const path of ['products', 'categories', 'brands']) {
        await request(app.getHttpServer())
          .get('/api/v1/inventory/' + path)
          .set('Authorization', 'Bearer ' + role)
          .expect(200);
      }
    },
  );

  it.each(['client', 'receptionist', 'veterinary_technician'])(
    'rechaza al rol %s sin permiso de lectura de inventario',
    async (role) => {
      await request(app.getHttpServer())
        .get('/api/v1/inventory/products')
        .set('Authorization', 'Bearer ' + role)
        .expect(403);
      expect(inventory.listProducts).not.toHaveBeenCalled();
    },
  );

  it('entrega los filtros de categoría, marca y lote al servicio y comunica la búsqueda vacía', async () => {
    const categoryId = '38026d50-937e-4e2a-a555-2d23ca206151';
    const brandId = '898376a6-a6b3-4f1b-99ac-983071f9f5bf';
    const batchCode = 'L-2026-001';
    const response = await request(app.getHttpServer())
      .get('/api/v1/inventory/products')
      .query({ categoryId, brandId, batchCode })
      .set('Authorization', 'Bearer cashier')
      .expect(200);

    expect(inventory.listProducts).toHaveBeenCalledWith(expect.objectContaining({ categoryId, brandId, batchCode }));
    expect(response.body).toMatchObject({ data: [], message: 'No se encontraron productos' });
  });

  it('rechaza referencias inválidas antes de consultar el inventario', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/inventory/products?categoryId=Alimentos')
      .set('Authorization', 'Bearer cashier')
      .expect(400);

    expect(inventory.listProducts).not.toHaveBeenCalled();
  });
});
