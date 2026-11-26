import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GlobalExceptionFilter } from '../../src/common/errors/global-exception.filter.js';
import configuration from '../../src/config/configuration.js';
import { ClientsModule } from '../../src/modules/clients/clients.module.js';
import { ClientsRepository } from '../../src/modules/clients/repositories/clients.repository.js';
import { IdentityModule } from '../../src/modules/identity/identity.module.js';
import { TokenService } from '../../src/modules/identity/services/token.service.js';
import { PrismaModule } from '../../src/infrastructure/database/prisma/prisma.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { inRollback, type Tx } from '../identity/support.js';

const EMAIL_DOMAIN = '@e2e-clientquery.test';
let counter = 0;

const identification = () => `97${`${Date.now()}${counter++}`.slice(-8)}`;
const email = () => `query.${Date.now()}.${counter++}${EMAIL_DOMAIN}`;

describe('GET /clients y /clients/:clientId/pets (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let repository: ClientsRepository;
  let readerToken: string;
  let noPetsToken: string;
  let noAccessToken: string;
  let clientRoleId: string;
  let speciesId: string;
  let breedId: string;
  let readerRoleId: string;
  const roleIds: string[] = [];
  const personIds: string[] = [];

  async function createRole(name: string, permissions: string[], category: 'STAFF' | 'CLIENT' = 'STAFF') {
    const role = await prisma.role.create({
      data: { name: `${name}_${Date.now()}_${counter++}`, displayName: name, category },
    });
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
      data: { identification: identification(), firstName: 'Acceso', lastName: 'Consulta', email: email() },
    });
    personIds.push(person.id);
    const user = await prisma.user.create({
      data: { personId: person.id, userRoles: { create: { roleId } } },
    });
    return user.id;
  }

  async function createClient(tx: Tx, options: { firstName: string; lastName: string; idNumber?: string; status?: 'ACTIVE' | 'INACTIVE' | 'DEACTIVATED' }) {
    const person = await tx.person.create({
      data: {
        identification: options.idNumber ?? identification(),
        firstName: options.firstName,
        lastName: options.lastName,
        email: email(),
      },
    });
    const userId = await tx.user.create({
      data: { personId: person.id, userRoles: { create: { roleId: clientRoleId } } },
    }).then((user) => user.id);
    const client = await tx.client.create({
      data: { personId: person.id, status: options.status ?? 'ACTIVE' },
    });
    return { clientId: client.id, userId };
  }

  async function createPet(tx: Tx, clientId: string, name: string) {
    return tx.patient.create({
      data: {
        name,
        gender: 'MALE',
        birthDate: new Date('2022-01-01'),
        weightKg: 12.5,
        heightCm: 45.3,
        reproductiveStatus: 'UNKNOWN',
        clientId,
        speciesId,
        breedId,
      },
    });
  }

  const get = (path: string, token: string | null = readerToken) => {
    const call = request(app.getHttpServer()).get(path);
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
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
        PrismaModule,
        IdentityModule,
        ClientsModule,
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    prisma = app.get(PrismaService);
    repository = app.get(ClientsRepository);
    const tokens = app.get(TokenService);

    const clientRole = await prisma.role.findUnique({ where: { name: 'client' } });
    if (clientRole) {
      clientRoleId = clientRole.id;
    } else {
      const created = await prisma.role.create({
        data: { name: 'client', displayName: 'Cliente', category: 'CLIENT' },
      });
      clientRoleId = created.id;
      roleIds.push(created.id);
    }

    const readerRole = await createRole('e2e_client_reader', ['clients:read', 'pets:read']);
    readerRoleId = readerRole.id;
    const noPetsRole = await createRole('e2e_client_no_pets', ['clients:read']);
    const noAccessRole = await createRole('e2e_client_no_access', []);
    readerToken = await tokens.issue(await createAccount(readerRoleId));
    noPetsToken = await tokens.issue(await createAccount(noPetsRole.id));
    noAccessToken = await tokens.issue(await createAccount(noAccessRole.id));

    const species = await prisma.species.create({ data: { name: `E2E Specie ${Date.now()}` } });
    speciesId = species.id;
    const breed = await prisma.breed.create({ data: { name: 'E2E Breed', speciesId } });
    breedId = breed.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.patient.deleteMany({ where: { speciesId } });
    await prisma.breed.deleteMany({ where: { id: breedId } });
    await prisma.species.deleteMany({ where: { id: speciesId } });
    await prisma.client.deleteMany({ where: { person: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.userRole.deleteMany({ where: { roleId: { in: roleIds } } });
    await prisma.user.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
    await prisma.rolePermission.deleteMany({ where: { roleId: { in: roleIds } } });
    await prisma.role.deleteMany({ where: { id: { in: roleIds } } });
    await app.close();
  });

  it('lista los clientes ordenados por apellido sin exponer datos de autenticación', async () => {
    await withTx(async (tx) => {
      await createClient(tx, { firstName: 'Zoe', lastName: 'Zamora' });
      await createClient(tx, { firstName: 'Ana', lastName: 'Aguilar' });

      const response = await get('/clients').expect(200);

      expect(response.body.data.items.length).toBeGreaterThanOrEqual(2);
      const apellidos = response.body.data.items.map((item: { lastName: string }) => item.lastName);
      expect(apellidos.indexOf('Aguilar')).toBeLessThan(apellidos.indexOf('Zamora'));
      expect(response.body.data.items[0]).toMatchObject({
        id: expect.any(String),
        identification: expect.any(String),
        email: expect.any(String),
        roles: expect.any(Array),
      });
      expect(JSON.stringify(response.body)).not.toContain('password');
    });
  });

  it('busca por cédula exacta y por nombre sin distinguir mayúsculas ni tildes', async () => {
    await withTx(async (tx) => {
      const carlos = await createClient(tx, { firstName: 'Carlos', lastName: 'Pérez', idNumber: '0987654321' });
      const jose = await createClient(tx, { firstName: 'José', lastName: 'López' });

      const byId = await get('/clients?search=0987654321').expect(200);
      expect(byId.body.data.items.map((item: { id: string }) => item.id)).toEqual([carlos.clientId]);

      const byName = await get('/clients?search=jose').expect(200);
      expect(byName.body.data.items.map((item: { id: string }) => item.id)).toContain(jose.clientId);

      const byUppercase = await get('/clients?search=JOSE').expect(200);
      expect(byUppercase.body.data.items.map((item: { id: string }) => item.id)).toContain(jose.clientId);
    });
  });

  it('rechaza una búsqueda de un carácter y respeta paginación y estado', async () => {
    await withTx(async (tx) => {
      for (let i = 0; i < 3; i++) {
        await createClient(tx, { firstName: `Pagina${i}`, lastName: `Estado${i}`, status: i === 2 ? 'INACTIVE' : 'ACTIVE' });
      }

      const short = await get('/clients?search=a').expect(400);
      expect(short.body.message).toBe('Ingrese al menos 2 caracteres para buscar por nombre o los 10 dígitos de la cédula');

      const page = await get('/clients?page=2&pageSize=2').expect(200);
      expect(page.body.data.page).toBe(2);
      expect(page.body.data.pageSize).toBe(2);

      const inactive = await get('/clients?status=INACTIVE').expect(200);
      expect(inactive.body.data.items.every((item: { status: string }) => item.status === 'INACTIVE')).toBe(true);
    });
  });

  it('rechaza peticiones sin token, sin permiso y con parámetros inválidos', async () => {
    await get('/clients', null).expect(401);

    const denied = await get('/clients', noAccessToken).expect(403);
    expect(denied.body.message).toBe('No tiene permisos para realizar esta acción');

    const unauthenticated = await get('/clients?search=ma', null).expect(401);
    expect(unauthenticated.body.message).toBeDefined();

    await get('/clients?page=0').expect(400);
    await get('/clients?pageSize=101').expect(400);
  });

  it('devuelve las mascotas del cliente ordenadas por nombre', async () => {
    await withTx(async (tx) => {
      const { clientId } = await createClient(tx, { firstName: 'Ana', lastName: 'Dueña' });
      await createPet(tx, clientId, 'Zorro');
      await createPet(tx, clientId, 'Firulais');

      const response = await get(`/clients/${clientId}/pets`).expect(200);

      expect(response.body.data.map((pet: { name: string }) => pet.name)).toEqual(['Firulais', 'Zorro']);
      expect(response.body.data[0]).toMatchObject({
        code: expect.any(String),
        species: expect.any(String),
        breed: expect.any(String),
        status: 'ACTIVE',
      });
    });
  });

  it('devuelve una lista vacía para un cliente sin mascotas', async () => {
    await withTx(async (tx) => {
      const { clientId } = await createClient(tx, { firstName: 'Sin', lastName: 'Mascotas' });

      const response = await get(`/clients/${clientId}/pets`).expect(200);

      expect(response.body.data).toEqual([]);
    });
  });

  it('valida el identificador, el cliente inexistente y el permiso pets:read', async () => {
    await get('/clients/not-an-uuid/pets').expect(400);
    await get('/clients/00000000-0000-0000-0000-000000000000/pets').expect(404);
    const denied = await get('/clients/00000000-0000-0000-0000-000000000000/pets', noPetsToken).expect(403);
    expect(denied.body.message).toBe('No tiene permisos para realizar esta acción');
  });
});
