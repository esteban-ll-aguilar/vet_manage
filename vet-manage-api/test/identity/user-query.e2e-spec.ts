import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GlobalExceptionFilter } from '../../src/common/errors/global-exception.filter.js';
import configuration from '../../src/config/configuration.js';
import { PrismaModule } from '../../src/infrastructure/database/prisma/prisma.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { IdentityModule } from '../../src/modules/identity/identity.module.js';
import { UserQueryRepository } from '../../src/modules/identity/repositories/user-query.repository.js';
import { TokenService } from '../../src/modules/identity/services/token.service.js';
import { inRollback, type Tx } from './support.js';

const EMAIL_DOMAIN = '@e2e-userquery.test';
let counter = 0;

function newIdentification() {
  return `99${`${Date.now()}${counter++}`.slice(-8)}`;
}

function newEmail() {
  return `query.${Date.now()}.${counter++}${EMAIL_DOMAIN}`;
}

describe('GET /users (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let repository: UserQueryRepository;
  let tokens: TokenService;
  let adminToken: string;
  let cashierToken: string;
  let vetRole: { id: string; name: string };
  let cashierRole: { id: string; name: string };
  const roleIds: string[] = [];
  const personIds: string[] = [];

  async function createRole(name: string, displayName: string, permissions: string[] = []) {
    const role = await prisma.role.create({ data: { name, displayName, category: 'STAFF' } });
    roleIds.push(role.id);
    for (const key of permissions) {
      const [module, action] = key.split(':');
      const permission = await prisma.permission.upsert({
        where: { permission_module_action_key: { module, action } },
        update: {},
        create: { module, action, displayName: key },
      });
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
    }
    return role;
  }

  async function createAccount(roleId: string) {
    const person = await prisma.person.create({
      data: {
        identification: newIdentification(),
        firstName: 'Acceso',
        lastName: 'Consulta',
        email: newEmail(),
      },
    });
    personIds.push(person.id);
    const user = await prisma.user.create({
      data: { personId: person.id, userRoles: { create: { roleId } } },
    });
    return user.id;
  }

  async function createQueryUser(
    tx: Tx,
    options: { firstName: string; lastName: string; identification?: string; status?: 'ACTIVE' | 'INACTIVE' | 'DEACTIVATED'; roles: string[] },
  ) {
    const person = await tx.person.create({
      data: {
        identification: options.identification ?? newIdentification(),
        firstName: options.firstName,
        lastName: options.lastName,
        email: newEmail(),
      },
    });
    const user = await tx.user.create({
      data: {
        personId: person.id,
        status: options.status ?? 'ACTIVE',
        userRoles: { create: options.roles.map((roleId) => ({ roleId })) },
      },
    });
    return user.id;
  }

  const get = (query = '', token: string | null = adminToken) => {
    const call = request(app.getHttpServer()).get(`/users${query}`);
    return token ? call.set('Authorization', `Bearer ${token}`) : call;
  };

  async function withTx(run: (tx: Tx) => Promise<void>) {
    const original = (repository as unknown as { prisma: unknown }).prisma;
    await inRollback(prisma, async (tx) => {
      (repository as unknown as { prisma: unknown }).prisma = tx;
      try {
        await run(tx);
      } finally {
        (repository as unknown as { prisma: unknown }).prisma = original;
      }
    });
  }

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, load: [configuration] }), PrismaModule, IdentityModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    prisma = app.get(PrismaService);
    repository = app.get(UserQueryRepository);
    tokens = app.get(TokenService);

    const suffix = Date.now();
    const adminRole = await createRole(`test_query_admin_${suffix}`, 'Administrador de prueba', ['users:read']);
    cashierRole = await createRole(`test_query_cashier_${suffix}`, 'Cajero de prueba');
    vetRole = await createRole(`test_query_vet_${suffix}`, 'Veterinario de prueba');
    adminToken = await tokens.issue(await createAccount(adminRole.id));
    cashierToken = await tokens.issue(await createAccount(cashierRole.id));
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.userRole.deleteMany({ where: { roleId: { in: roleIds } } });
    await prisma.user.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
    await prisma.rolePermission.deleteMany({ where: { roleId: { in: roleIds } } });
    await prisma.role.deleteMany({ where: { id: { in: roleIds } } });
    await app.close();
  });

  it('muestra la lista ordenada por apellido con todos los campos de la fila', async () => {
    await withTx(async (tx) => {
      const ids = await Promise.all([
        createQueryUser(tx, { firstName: 'Zoe', lastName: 'Zamora', roles: [vetRole.id] }),
        createQueryUser(tx, { firstName: 'Ana', lastName: 'Aguilar', roles: [vetRole.id] }),
        createQueryUser(tx, { firstName: 'Luis', lastName: 'Mena', roles: [vetRole.id] }),
      ]);

      const response = await get('?role=' + vetRole.name).expect(200);

      const found = response.body.data.items.filter((item: { id: string }) => ids.includes(item.id));
      expect(found.map((item: { lastName: string }) => item.lastName)).toEqual(['Aguilar', 'Mena', 'Zamora']);
      expect(found[0]).toMatchObject({
        identification: expect.any(String),
        email: expect.any(String),
        status: 'ACTIVE',
        roles: [{ name: vetRole.name, displayName: 'Veterinario de prueba' }],
      });
      expect(response.body.data.pageSize).toBe(20);
      expect(response.body.data.total).toBe(3);
    });
  });

  it('devuelve la segunda página de 20 y el total de coincidencias', async () => {
    await withTx(async (tx) => {
      for (let i = 0; i < 21; i++) {
        await createQueryUser(tx, { firstName: `Usuario${i}`, lastName: `Pagina${String(i).padStart(2, '0')}`, roles: [vetRole.id] });
      }

      const second = await get(`?role=${vetRole.name}&page=2`).expect(200);
      const first = await get(`?role=${vetRole.name}&page=1`).expect(200);

      expect(first.body.data.items).toHaveLength(20);
      expect(second.body.data.items).toHaveLength(1);
      expect(second.body.data.total).toBe(21);
      expect(second.body.data.page).toBe(2);
    });
  });

  it('busca por cédula exacta y por nombre parcial', async () => {
    await withTx(async (tx) => {
      const identification = newIdentification();
      const carlos = await createQueryUser(tx, { firstName: 'Carlos', lastName: 'Pérez', identification, roles: [vetRole.id] });
      const ana = await createQueryUser(tx, { firstName: 'Ana', lastName: 'Pérez', roles: [vetRole.id] });

      const byId = await get('?q=' + identification).expect(200);
      expect(byId.body.data.items.map((item: { id: string }) => item.id)).toEqual([carlos]);

      const byName = await get('?q=P%C3%A9rez').expect(200);
      expect(byName.body.data.items.map((item: { id: string }) => item.id)).toEqual(expect.arrayContaining([carlos, ana]));
    });
  });

  it('muestra todos los roles de un usuario al filtrar por uno de ellos', async () => {
    await withTx(async (tx) => {
      const id = await createQueryUser(tx, { firstName: 'Multi', lastName: 'Rol', roles: [vetRole.id, cashierRole.id] });

      const response = await get('?role=' + vetRole.name).expect(200);

      const item = response.body.data.items.find((row: { id: string }) => row.id === id);
      expect(item.roles).toHaveLength(2);
      expect(item.roles.map((role: { name: string }) => role.name)).toEqual(expect.arrayContaining([vetRole.name, cashierRole.name]));
    });
  });

  it('filtra por estado y excluye a los dados de baja', async () => {
    await withTx(async (tx) => {
      const active = await createQueryUser(tx, { firstName: 'Activo', lastName: 'Estado', roles: [vetRole.id] });
      const inactive = await createQueryUser(tx, { firstName: 'Inactivo', lastName: 'Estado', status: 'INACTIVE', roles: [vetRole.id] });
      await createQueryUser(tx, { firstName: 'Baja', lastName: 'Estado', status: 'DEACTIVATED', roles: [vetRole.id] });

      const response = await get(`?role=${vetRole.name}&status=INACTIVE`).expect(200);

      expect(response.body.data.items.map((item: { id: string }) => item.id)).toEqual([inactive]);
      expect(response.body.data.items.map((item: { id: string }) => item.id)).not.toContain(active);
    });
  });

  it('combina búsqueda, rol y estado', async () => {
    await withTx(async (tx) => {
      const expected = await createQueryUser(tx, { firstName: 'Carlos', lastName: 'Combo', roles: [vetRole.id] });
      await createQueryUser(tx, { firstName: 'Carlos', lastName: 'Combo', status: 'INACTIVE', roles: [vetRole.id] });
      await createQueryUser(tx, { firstName: 'Carlos', lastName: 'Combo', roles: [cashierRole.id] });

      const response = await get(`?q=Combo&role=${vetRole.name}&status=ACTIVE`).expect(200);

      expect(response.body.data.items.map((item: { id: string }) => item.id)).toEqual([expected]);
    });
  });

  it('devuelve una lista vacía cuando no hay coincidencias', async () => {
    const response = await get('?q=0000000000').expect(200);

    expect(response.body.data.items).toEqual([]);
    expect(response.body.data.total).toBe(0);
  });

  it('rechaza peticiones sin token, sin permiso y con parámetros inválidos', async () => {
    await get('', null).expect(401);

    const denied = await get('', cashierToken).expect(403);
    expect(denied.body.message).toBe('No tiene permisos para realizar esta acción');

    await get('?page=0').expect(400);
    await get('?pageSize=10').expect(400);
  });
});
