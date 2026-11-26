import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import configuration from '../../../config/configuration.js';
import { ApiException } from '../../../common/errors/api-exception.js';
import { GlobalExceptionFilter } from '../../../common/errors/global-exception.filter.js';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';
import { AccessService } from '../../identity/services/access.service.js';
import { TokenService } from '../../identity/services/token.service.js';
import { SuppliersModule } from '../suppliers.module.js';
import { SuppliersService } from '../services/suppliers.service.js';

const SUPPLIER_ID = '123e4567-e89b-12d3-a456-426614174000';
const activeSupplier = {
  id: SUPPLIER_ID,
  businessName: 'Distribuidora Vet',
  ruc: '0012345678001',
  isActive: true,
  createdAt: '2026-11-20T10:00:00.000Z',
  updatedAt: '2026-11-20T10:00:00.000Z',
};
const inactiveSupplier = { ...activeSupplier, isActive: false };
const allPermissions = new Set([
  'suppliers:create',
  'suppliers:read',
  'suppliers:update',
  'suppliers:deactivate',
]);

describe('SuppliersController HTTP contract', () => {
  let app: INestApplication;
  let grantedPermissions = new Set(allPermissions);

  const service = {
    create: vi.fn(async () => activeSupplier),
    list: vi.fn(async () => ({ items: [inactiveSupplier], page: 1, pageSize: 20, total: 1, totalPages: 1 })),
    findById: vi.fn(async () => inactiveSupplier),
    update: vi.fn(async () => ({ ...activeSupplier, businessName: 'Razón social actualizada' })),
    deactivate: vi.fn(async () => {
      throw new ApiException(
        'No se puede desactivar el proveedor porque aún no es posible verificar órdenes de compra pendientes',
        503,
        [],
        'SUPPLIER_DEACTIVATION_CHECK_UNAVAILABLE',
      );
    }),
  };
  const tokens = { verify: vi.fn(async () => 'user-1') };
  const access = {
    findActiveUser: vi.fn(async () => ({ id: 'user-1' })),
    getPermissionKeys: vi.fn(async () => grantedPermissions),
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'secret-for-testing-only-at-least-32-chars-long';

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, load: [configuration] }), SuppliersModule],
    })
      .overrideProvider(PrismaService).useValue({})
      .overrideProvider(SuppliersService).useValue(service)
      .overrideProvider(TokenService).useValue(tokens)
      .overrideProvider(AccessService).useValue(access)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  beforeEach(() => {
    grantedPermissions = new Set(allPermissions);
    vi.clearAllMocks();
    service.create.mockResolvedValue(activeSupplier);
    service.list.mockResolvedValue({ items: [inactiveSupplier], page: 1, pageSize: 20, total: 1, totalPages: 1 });
    service.findById.mockResolvedValue(inactiveSupplier);
    service.update.mockResolvedValue({ ...activeSupplier, businessName: 'Razón social actualizada' });
    service.deactivate.mockImplementation(async () => {
      throw new ApiException(
        'No se puede desactivar el proveedor porque aún no es posible verificar órdenes de compra pendientes',
        503,
        [],
        'SUPPLIER_DEACTIVATION_CHECK_UNAVAILABLE',
      );
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('registra y envuelve la respuesta estándar con estado Activo (201)', async () => {
    const response = await request(app.getHttpServer())
      .post('/suppliers')
      .set('Authorization', 'Bearer token')
      .send({ businessName: '  Distribuidora Vet  ', ruc: '  0012345678001  ' })
      .expect(201);

    expect(service.create).toHaveBeenCalledWith({ businessName: 'Distribuidora Vet', ruc: '0012345678001' });
    expect(response.body).toMatchObject({
      success: true,
      message: 'Proveedor registrado correctamente',
      data: { id: SUPPLIER_ID, isActive: true, ruc: '0012345678001' },
    });
  });

  it('serializa conflictos de RUC como respuesta 409 sin detalles del proveedor existente', async () => {
    service.create.mockRejectedValueOnce(ApiException.conflict('El RUC ya está registrado'));

    const response = await request(app.getHttpServer())
      .post('/suppliers')
      .set('Authorization', 'Bearer token')
      .send({ businessName: 'Otro proveedor', ruc: '0012345678001' })
      .expect(409);

    expect(response.body).toMatchObject({ success: false, message: 'El RUC ya está registrado' });
  });

  it.each([
    [{ businessName: '  ', ruc: '0012345678001' }],
    [{ businessName: 'Distribuidora Vet', ruc: '   ' }],
    [{ businessName: 'Distribuidora Vet', ruc: '123456789012' }],
    [{ businessName: 'Distribuidora Vet', ruc: '12345678901234' }],
    [{ businessName: 'Distribuidora Vet', ruc: '123456789012A' }],
  ])('rechaza razón social/RUC inválido antes de invocar el servicio (400)', async (body) => {
    await request(app.getHttpServer())
      .post('/suppliers')
      .set('Authorization', 'Bearer token')
      .send(body)
      .expect(400);

    expect(service.create).not.toHaveBeenCalled();
  });

  it('rechaza propiedades de estado no autorizadas en registro y actualización', async () => {
    await request(app.getHttpServer())
      .post('/suppliers')
      .set('Authorization', 'Bearer token')
      .send({ businessName: 'Proveedor', ruc: '0000123456789', isActive: false })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/suppliers/${SUPPLIER_ID}`)
      .set('Authorization', 'Bearer token')
      .send({ isActive: false })
      .expect(400);

    expect(service.create).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
  });

  it('rechaza un RUC de actualización que no contenga exactamente 13 dígitos numéricos', async () => {
    await request(app.getHttpServer())
      .patch(`/suppliers/${SUPPLIER_ID}`)
      .set('Authorization', 'Bearer token')
      .send({ ruc: '123456789012A' })
      .expect(400);

    expect(service.update).not.toHaveBeenCalled();
  });

  it('lista proveedores inactivos y valida/pasa los parámetros de consulta', async () => {
    const response = await request(app.getHttpServer())
      .get('/suppliers?page=2&pageSize=10&search=vet&status=INACTIVE')
      .set('Authorization', 'Bearer token')
      .expect(200);

    expect(service.list).toHaveBeenCalledWith({ page: 2, pageSize: 10, search: 'vet', status: 'INACTIVE' });
    expect(response.body.data.items[0]).toMatchObject({ isActive: false });
  });

  it('consulta por UUID e impide el paso de identificadores inválidos', async () => {
    await request(app.getHttpServer())
      .get(`/suppliers/${SUPPLIER_ID}`)
      .set('Authorization', 'Bearer token')
      .expect(200);
    expect(service.findById).toHaveBeenCalledWith(SUPPLIER_ID);

    await request(app.getHttpServer())
      .get('/suppliers/not-a-uuid')
      .set('Authorization', 'Bearer token')
      .expect(400);
    expect(service.findById).toHaveBeenCalledOnce();
  });

  it('actualiza por UUID y devuelve la identidad original del proveedor', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/suppliers/${SUPPLIER_ID}`)
      .set('Authorization', 'Bearer token')
      .send({ businessName: 'Razón social actualizada' })
      .expect(200);

    expect(service.update).toHaveBeenCalledWith(SUPPLIER_ID, { businessName: 'Razón social actualizada' });
    expect(response.body.data.id).toBe(SUPPLIER_ID);
  });

  it('rechaza llamadas no autenticadas y usuarios sin permiso', async () => {
    await request(app.getHttpServer()).get('/suppliers').expect(401);

    grantedPermissions = new Set();
    const response = await request(app.getHttpServer())
      .post('/suppliers')
      .set('Authorization', 'Bearer token')
      .send({ businessName: 'Proveedor', ruc: '0000123456789' })
      .expect(403);

    expect(response.body.message).toBe('No tiene permisos para realizar esta acción');
    expect(service.create).not.toHaveBeenCalled();
  });

  it('rechaza desactivar mientras el estado de órdenes no pueda verificarse', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/suppliers/${SUPPLIER_ID}/deactivate`)
      .set('Authorization', 'Bearer token')
      .expect(503);

    expect(response.body.code).toBe('SUPPLIER_DEACTIVATION_CHECK_UNAVAILABLE');
    expect(service.deactivate).toHaveBeenCalledWith(SUPPLIER_ID);
  });

  it('no expone errores internos al cliente', async () => {
    service.create.mockRejectedValueOnce(new Error('postgres connection details must stay private'));

    const response = await request(app.getHttpServer())
      .post('/suppliers')
      .set('Authorization', 'Bearer token')
      .send({ businessName: 'Proveedor', ruc: '0000123456789' })
      .expect(500);

    expect(response.body.message).toBe('Error interno del servidor');
    expect(JSON.stringify(response.body)).not.toContain('postgres connection details');
  });
});
