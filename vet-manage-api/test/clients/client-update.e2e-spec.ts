import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobalExceptionFilter } from '../../src/common/errors/global-exception.filter.js';
import configuration from '../../src/config/configuration.js';
import { ROLES } from '../../src/config/roles.catalog.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { AuditService } from '../../src/modules/audit/services/audit.service.js';
import { ClientsModule } from '../../src/modules/clients/clients.module.js';
import { AccessService } from '../../src/modules/identity/services/access.service.js';
import { TokenService } from '../../src/modules/identity/services/token.service.js';

const CLIENT_ID = '123e4567-e89b-12d3-a456-426614174000';
const PERSON_ID = '123e4567-e89b-12d3-a456-426614174100';

const permissionsOf = (role: string) => new Set<string>(ROLES.find((item) => item.name === role)?.permissions ?? []);

const storedClient = (status = 'ACTIVE', categories: string[] = ['CLIENT']) => ({
  id: CLIENT_ID,
  status,
  person: {
    id: PERSON_ID,
    identification: '1710034065',
    firstName: 'Carlos',
    lastName: 'Pérez',
    email: 'cperez@correo.com',
    phone: '0991111111',
    address: null,
    user: { userRoles: categories.map((category) => ({ role: { category } })) },
  },
});

const body = (overrides: Record<string, unknown> = {}) => ({
  identification: '1710034065',
  firstName: 'Carlos',
  lastName: 'Pérez',
  email: 'cperez@correo.com',
  phone: '0992222222',
  address: 'Av. Amazonas 123',
  ...overrides,
});

describe('PATCH /clients/:clientId (e2e)', () => {
  let app: INestApplication;
  let permissions: Set<string>;
  const tx = {
    client: { findUnique: vi.fn() },
    person: { findFirst: vi.fn(), update: vi.fn() },
  };
  const prisma = { $transaction: vi.fn(async (run: (client: typeof tx) => unknown) => run(tx)) };
  const audit = { record: vi.fn(async () => undefined) };
  const tokens = { verify: vi.fn(async () => 'user-1') };
  const access = {
    findActiveUser: vi.fn(async () => ({ id: 'user-1' })),
    getPermissionKeys: vi.fn(async () => permissions),
  };

  const patch = (payload: unknown, path = `/clients/${CLIENT_ID}`) =>
    request(app.getHttpServer()).patch(path).set('Authorization', 'Bearer t').send(payload as object);

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/vet_manage';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'secret-for-testing-only-at-least-32-chars-long';
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, load: [configuration] }), ClientsModule],
    })
      .overrideProvider(PrismaService).useValue(prisma)
      .overrideProvider(AuditService).useValue(audit)
      .overrideProvider(TokenService).useValue(tokens)
      .overrideProvider(AccessService).useValue(access)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    permissions = permissionsOf('receptionist');
    tx.client.findUnique.mockResolvedValue(storedClient());
    tx.person.findFirst.mockResolvedValue(null);
    tx.person.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...storedClient().person,
      ...data,
    }));
  });

  it('actualiza los datos y responde con el cliente actualizado (200)', async () => {
    const response = await patch(body()).expect(200);

    expect(response.body).toMatchObject({
      success: true,
      message: 'Datos actualizados correctamente',
      data: {
        id: CLIENT_ID,
        identification: '1710034065',
        phone: '0992222222',
        address: 'Av. Amazonas 123',
        status: 'ACTIVE',
      },
    });
    expect(tx.person.update).toHaveBeenCalledWith({
      where: { id: PERSON_ID },
      data: { phone: '0992222222', address: 'Av. Amazonas 123' },
    });
    expect(audit.record).toHaveBeenCalledTimes(1);
  });

  it('no cambia la cédula aunque se envíe otra (200)', async () => {
    const response = await patch(body({ identification: '0102030405' })).expect(200);

    expect(response.body.data.identification).toBe('1710034065');
    expect(tx.person.update.mock.calls[0][0].data).not.toHaveProperty('identification');
  });

  it('rechaza los obligatorios vacíos indicando los campos (400)', async () => {
    const response = await patch(body({ firstName: '', phone: ' ' })).expect(400);

    expect(response.body.message).toBe('Por favor, complete todos los campos obligatorios');
    expect(response.body.errors).toEqual(['firstName', 'phone']);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([[{ email: 'carlos@' }, 'email'], [{ phone: '0991' }, 'phone']])('rechaza el formato de %j (400)', async (override, field) => {
    const response = await patch(body(override)).expect(400);

    expect(response.body.message).toBe('Por favor, ingrese un correo y número de teléfono válido');
    expect(response.body.errors).toEqual([field]);
  });

  it('rechaza campos que no son editables (400)', async () => {
    await patch(body({ status: 'DEACTIVATED' })).expect(400);
  });

  it('rechaza un identificador mal formado sin consultar la base (400)', async () => {
    await patch(body(), '/clients/abc').expect(400);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('responde 404 si el cliente no existe', async () => {
    tx.client.findUnique.mockResolvedValue(null);

    const response = await patch(body()).expect(404);

    expect(response.body.message).toBe('Cliente no encontrado');
  });

  it('rechaza un cliente dado de baja (409)', async () => {
    tx.client.findUnique.mockResolvedValue(storedClient('DEACTIVATED'));

    const response = await patch(body()).expect(409);

    expect(response.body.message).toBe('No se puede actualizar un cliente dado de baja');
    expect(tx.person.update).not.toHaveBeenCalled();
  });

  it('rechaza un correo de otra persona (409)', async () => {
    tx.person.findFirst.mockResolvedValue({ id: 'otra-persona' });

    const response = await patch(body({ email: 'ana@correo.com' })).expect(409);

    expect(response.body.message).toBe('El correo ya se encuentra registrado');
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('no cambia el correo de un cliente que también es personal (409)', async () => {
    tx.client.findUnique.mockResolvedValue(storedClient('ACTIVE', ['CLIENT', 'STAFF']));

    const response = await patch(body({ email: 'nuevo@correo.com' })).expect(409);

    expect(response.body.message).toBe('El correo de este cliente también es el de su cuenta del personal; solo el Administrador puede cambiarlo');
    expect(response.body.errors).toEqual(['email']);
  });

  it('exige sesión iniciada (401)', async () => {
    await request(app.getHttpServer()).patch(`/clients/${CLIENT_ID}`).send(body()).expect(401);
  });

  // Matriz de roles, sección 2.2: actualizan clientes el Gerente, el Veterinario y la Recepcionista.
  it.each(['manager', 'veterinarian', 'receptionist'])('permite actualizar a %s (200)', async (role) => {
    permissions = permissionsOf(role);

    await patch(body()).expect(200);
  });

  it.each(['administrator', 'veterinary_technician', 'cashier', 'warehouse_keeper'])('rechaza a %s (403)', async (role) => {
    permissions = permissionsOf(role);

    const response = await patch(body()).expect(403);

    expect(response.body.message).toBe('No tiene permisos para realizar esta acción');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
