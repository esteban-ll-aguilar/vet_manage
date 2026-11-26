import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { GlobalExceptionFilter } from '../../src/common/errors/global-exception.filter.js';
import configuration from '../../src/config/configuration.js';
import { ROLES } from '../../src/config/roles.catalog.js';
import { PrismaModule } from '../../src/infrastructure/database/prisma/prisma.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { MailService } from '../../src/infrastructure/mail/mail.service.js';
import { PetsModule } from '../../src/modules/pets/pets.module.js';
import { TokenService } from '../../src/modules/identity/services/token.service.js';
import { deleteAuditLogsOfPeople } from '../identity/support.js';

type Status = 'ACTIVE' | 'INACTIVE' | 'DEACTIVATED';

const EMAIL_DOMAIN = '@e2e-clientactivation.test';
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';
let counter = 0;

const unique = () => `${Date.now()}${counter++}`;
const newIdentification = () => `95${unique().slice(-8)}`;
const permissionsOf = (role: string) => ROLES.find((item) => item.name === role)?.permissions ?? [];

describe('Activar un cliente (e2e, HU-05)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  let speciesId: string;
  let breedId: string;
  let clientRoleId: string;
  const tokensByRole = new Map<string, string>();
  const actorIdsByRole = new Map<string, string>();
  const roleIds: string[] = [];
  const staffPersonIds: string[] = [];
  const clientPersonIds: string[] = [];

  // Rol de prueba con los permisos que el catálogo da al rol real, para no depender de los datos del seed.
  async function createRoleLike(role: string) {
    const created = await prisma.role.create({
      data: { name: `test_ca_${role}_${unique()}`, displayName: `CA ${role}`, category: 'STAFF', isActive: true },
    });
    roleIds.push(created.id);
    for (const key of permissionsOf(role)) {
      const [module, action] = key.split(':');
      const permission = await prisma.permission.upsert({
        where: { permission_module_action_key: { module, action } },
        update: { isActive: true },
        create: { module, action, displayName: key, isActive: true },
      });
      await prisma.rolePermission.create({ data: { roleId: created.id, permissionId: permission.id } });
    }
    return created.id;
  }

  async function createStaff(role: string) {
    const person = await prisma.person.create({
      data: { identification: newIdentification(), firstName: 'Staff', lastName: role, email: `staff.${unique()}${EMAIL_DOMAIN}` },
    });
    staffPersonIds.push(person.id);
    const user = await prisma.user.create({
      data: { personId: person.id, status: 'ACTIVE', password: 'not-used', mustChangePassword: false },
    });
    await prisma.userRole.create({ data: { userId: user.id, roleId: await createRoleLike(role) } });
    actorIdsByRole.set(role, user.id);
    tokensByRole.set(role, await tokens.issue(user.id));
  }

  async function createClient(status: Status = 'INACTIVE') {
    const person = await prisma.person.create({
      data: {
        identification: newIdentification(),
        firstName: 'María',
        lastName: 'López',
        email: `cliente.${unique()}${EMAIL_DOMAIN}`,
        phone: '0991234567',
        address: 'Av. Amazonas 123',
      },
    });
    clientPersonIds.push(person.id);
    const client = await prisma.client.create({ data: { personId: person.id, status } });
    // Como en el registro (HU-01), el cliente tiene una cuenta con el rol client: el listado solo muestra a esas personas.
    const user = await prisma.user.create({
      data: { personId: person.id, status: 'ACTIVE', password: 'not-used', mustChangePassword: false },
    });
    await prisma.userRole.create({ data: { userId: user.id, roleId: clientRoleId } });
    return { id: client.id, person };
  }

  const activate = (clientId: string, token: string | null = tokensByRole.get('receptionist') ?? null) => {
    const call = request(app.getHttpServer()).patch(`/clients/${clientId}/activate`);
    return token ? call.set('Authorization', `Bearer ${token}`) : call;
  };

  const statusOf = async (clientId: string) =>
    (await prisma.client.findUniqueOrThrow({ where: { id: clientId }, select: { status: true } })).status;

  const auditOf = (identification: string) =>
    prisma.auditLog.findMany({ where: { module: 'Clientes', affectedRecord: { startsWith: identification } } });

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, load: [configuration] }), PrismaModule, PetsModule],
    })
      .overrideProvider(MailService)
      .useValue({ send: vi.fn(async () => undefined) })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    prisma = app.get(PrismaService);
    tokens = app.get(TokenService);

    for (const role of ['manager', 'veterinarian', 'veterinary_technician', 'receptionist', 'cashier']) {
      await createStaff(role);
    }
    const clientRole = await prisma.role.findUnique({ where: { name: 'client' } });
    if (clientRole) {
      clientRoleId = clientRole.id;
    } else {
      clientRoleId = (await prisma.role.create({
        data: { name: 'client', displayName: 'Cliente', category: 'CLIENT', isActive: true },
      })).id;
      roleIds.push(clientRoleId);
    }
    const species = await prisma.species.create({ data: { name: `Especie CA ${unique()}` } });
    speciesId = species.id;
    breedId = (await prisma.breed.create({ data: { name: 'Raza CA', speciesId } })).id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await deleteAuditLogsOfPeople(prisma, staffPersonIds);
    await prisma.patient.deleteMany({ where: { client: { personId: { in: clientPersonIds } } } });
    await prisma.client.deleteMany({ where: { personId: { in: clientPersonIds } } });
    if (breedId) await prisma.breed.deleteMany({ where: { id: breedId } });
    if (speciesId) await prisma.species.deleteMany({ where: { id: speciesId } });
    const peopleWithUser = [...staffPersonIds, ...clientPersonIds];
    await prisma.userSession.deleteMany({ where: { user: { personId: { in: peopleWithUser } } } });
    await prisma.userRole.deleteMany({ where: { user: { personId: { in: peopleWithUser } } } });
    await prisma.user.deleteMany({ where: { personId: { in: peopleWithUser } } });
    await prisma.person.deleteMany({ where: { id: { in: [...staffPersonIds, ...clientPersonIds] } } });
    await prisma.rolePermission.deleteMany({ where: { roleId: { in: roleIds } } });
    await prisma.role.deleteMany({ where: { id: { in: roleIds } } });
    await app.close();
  });

  it('activa un cliente inactivo y registra la fecha y el usuario en la auditoría (200)', async () => {
    const { id, person } = await createClient('INACTIVE');
    const before = new Date();

    const response = await activate(id).expect(200);

    expect(response.body).toMatchObject({
      success: true,
      message: 'Cliente activado correctamente',
      data: { id, status: 'ACTIVE' },
    });
    expect(await statusOf(id)).toBe('ACTIVE');
    const logs = await auditOf(person.identification);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      userId: actorIdsByRole.get('receptionist'),
      action: 'Activar',
      module: 'Clientes',
      affectedRecord: `${person.identification} - María López`,
      previousValue: { status: 'Inactivo' },
      newValue: { status: 'Activo' },
    });
    expect(logs[0].occurredAt.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
  });

  it('responde con éxito si el cliente ya está activo, sin registrar auditoría (200)', async () => {
    const { id, person } = await createClient('ACTIVE');

    const response = await activate(id).expect(200);

    expect(response.body.data).toEqual({ id, status: 'ACTIVE' });
    expect(await auditOf(person.identification)).toHaveLength(0);
  });

  it('rechaza activar un cliente dado de baja y lo deja dado de baja (400)', async () => {
    const { id, person } = await createClient('DEACTIVATED');

    const response = await activate(id).expect(400);

    expect(response.body).toMatchObject({
      success: false,
      message: 'No se puede activar un cliente dado de baja',
      code: 'CLIENT_STATUS_DEACTIVATED',
    });
    expect(await statusOf(id)).toBe('DEACTIVATED');
    expect(await auditOf(person.identification)).toHaveLength(0);
  });

  it('responde 404 si el cliente no existe', async () => {
    const response = await activate(UNKNOWN_ID).expect(404);

    expect(response.body.message).toBe('Cliente no encontrado');
  });

  it('rechaza un identificador que no es UUID (400)', async () => {
    await activate('no-es-uuid').expect(400);
  });

  it('exige sesión (401)', async () => {
    const { id } = await createClient('INACTIVE');

    await activate(id, null).expect(401);
    expect(await statusOf(id)).toBe('INACTIVE');
  });

  // Matriz de roles, sección 2.2: el Técnico Veterinario y el Cajero no activan clientes.
  it.each(['veterinary_technician', 'cashier'])('rechaza a %s (403)', async (role) => {
    const { id } = await createClient('INACTIVE');

    const response = await activate(id, tokensByRole.get(role) ?? null).expect(403);

    expect(response.body.message).toBe('No tiene permisos para realizar esta acción');
    expect(await statusOf(id)).toBe('INACTIVE');
  });

  it.each(['receptionist', 'manager', 'veterinarian'])('permite activar a %s (200)', async (role) => {
    const { id } = await createClient('INACTIVE');

    await activate(id, tokensByRole.get(role) ?? null).expect(200);

    expect(await statusOf(id)).toBe('ACTIVE');
  });

  it('después de activarlo, el cliente se puede elegir al registrar un paciente y conserva sus datos y mascotas', async () => {
    const { id, person } = await createClient('ACTIVE');
    const token = tokensByRole.get('receptionist') ?? null;
    const patient = (name: string) => ({
      name,
      speciesId,
      breedId,
      gender: 'MALE',
      birthDate: '15-01-2022',
      weightKg: 12.5,
      heightCm: 40,
      reproductiveStatus: 'UNKNOWN',
      clientId: id,
    });
    const register = (name: string) =>
      request(app.getHttpServer()).post('/pets').set('Authorization', `Bearer ${token}`).send(patient(name));

    await register('Firulais').expect(201);
    await request(app.getHttpServer()).patch(`/clients/${id}/inactivate`).set('Authorization', `Bearer ${token}`).expect(200);
    const blocked = await register('Bobby').expect(409);
    expect(blocked.body.message).toBe('El cliente seleccionado no está disponible');

    await activate(id).expect(200);

    await register('Bobby').expect(201);

    // Escenario 3 de la HU: el Recepcionista, el Gerente y el Veterinario consultan sus datos y mascotas sin cambios.
    for (const role of ['receptionist', 'manager', 'veterinarian']) {
      const auth = `Bearer ${tokensByRole.get(role)}`;
      const list = await request(app.getHttpServer())
        .get('/clients')
        .query({ search: person.identification })
        .set('Authorization', auth)
        .expect(200);
      expect(list.body.data.items).toHaveLength(1);
      expect(list.body.data.items[0]).toMatchObject({
        id,
        identification: person.identification,
        firstName: 'María',
        lastName: 'López',
        email: person.email,
        phone: '0991234567',
        address: 'Av. Amazonas 123',
        status: 'ACTIVE',
      });

      const pets = await request(app.getHttpServer()).get(`/clients/${id}/pets`).set('Authorization', auth).expect(200);
      expect(pets.body.data.map((pet: { name: string }) => pet.name).sort()).toEqual(['Bobby', 'Firulais']);
    }
  });
});
