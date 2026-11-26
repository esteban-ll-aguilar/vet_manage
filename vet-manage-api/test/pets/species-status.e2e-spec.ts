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
import { TokenService } from '../../src/modules/identity/services/token.service.js';
import { PetsModule } from '../../src/modules/pets/pets.module.js';
import { deleteAuditLogsOfPeople } from '../identity/support.js';

const EMAIL_DOMAIN = '@e2e-speciesstatus.test';
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';
let counter = 0;

const unique = () => `${Date.now()}${counter++}`;
const permissionsOf = (role: string) => ROLES.find((item) => item.name === role)?.permissions ?? [];

describe('Activar e inactivar especie (e2e, HU-15)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  const tokensByRole = new Map<string, string>();
  const actorIdsByRole = new Map<string, string>();
  const roleIds: string[] = [];
  const staffPersonIds: string[] = [];
  const speciesIds: string[] = [];
  const clientPersonIds: string[] = [];

  // Rol de prueba con los permisos que el catálogo da al rol real, para no depender de los datos del seed.
  async function createRoleLike(role: string) {
    const created = await prisma.role.create({
      data: { name: `test_ss_${role}_${unique()}`, displayName: `SS ${role}`, category: 'STAFF', isActive: true },
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
      data: {
        identification: `94${unique().slice(-8)}`,
        firstName: 'Staff',
        lastName: role,
        email: `staff.${unique()}${EMAIL_DOMAIN}`,
      },
    });
    staffPersonIds.push(person.id);
    const user = await prisma.user.create({
      data: { personId: person.id, status: 'ACTIVE', password: 'not-used', mustChangePassword: false },
    });
    await prisma.userRole.create({ data: { userId: user.id, roleId: await createRoleLike(role) } });
    actorIdsByRole.set(role, user.id);
    tokensByRole.set(role, await tokens.issue(user.id));
  }

  async function createSpecies(isActive = true) {
    const species = await prisma.species.create({ data: { name: `Especie SS ${unique()}`, isActive } });
    speciesIds.push(species.id);
    return species;
  }

  // Paciente ya registrado con la especie, para comprobar que inactivarla no lo cambia (R-07).
  async function createPatient(speciesId: string, breedId: string) {
    const person = await prisma.person.create({
      data: {
        identification: `93${unique().slice(-8)}`,
        firstName: 'Dueña',
        lastName: 'Prueba',
        email: `cliente.${unique()}${EMAIL_DOMAIN}`,
      },
    });
    clientPersonIds.push(person.id);
    const client = await prisma.client.create({ data: { personId: person.id } });
    return prisma.patient.create({
      data: {
        name: 'Firulais',
        gender: 'MALE',
        birthDate: new Date('2022-01-15'),
        weightKg: 12.5,
        heightCm: 40,
        reproductiveStatus: 'UNKNOWN',
        clientId: client.id,
        speciesId,
        breedId,
      },
    });
  }

  const auth = (role: string) => `Bearer ${tokensByRole.get(role)}`;
  const changeStatus = (id: string, body: object, role: string | null = 'veterinarian') => {
    const call = request(app.getHttpServer()).patch(`/pets/species/${id}/status`).send(body);
    return role ? call.set('Authorization', auth(role)) : call;
  };
  const isActiveOf = async (id: string) =>
    (await prisma.species.findUniqueOrThrow({ where: { id }, select: { isActive: true } })).isActive;
  const auditOf = (name: string) =>
    prisma.auditLog.findMany({ where: { module: 'Especies', affectedRecord: name }, orderBy: { occurredAt: 'asc' } });
  const activeNames = async (role: string) => {
    const response = await request(app.getHttpServer()).get('/pets/species/active').set('Authorization', auth(role)).expect(200);
    return response.body.data.map((item: { name: string }) => item.name) as string[];
  };
  const registerBreed = (speciesId: string, name = `Raza SS ${unique()}`) =>
    request(app.getHttpServer()).post('/pets/breeds').set('Authorization', auth('veterinarian')).send({ name, speciesId });

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

    for (const role of ['veterinarian', 'manager', 'veterinary_technician', 'receptionist']) {
      await createStaff(role);
    }
  });

  afterAll(async () => {
    if (!prisma) return;
    await deleteAuditLogsOfPeople(prisma, staffPersonIds);
    await prisma.patient.deleteMany({ where: { speciesId: { in: speciesIds } } });
    await prisma.client.deleteMany({ where: { personId: { in: clientPersonIds } } });
    await prisma.breed.deleteMany({ where: { speciesId: { in: speciesIds } } });
    await prisma.species.deleteMany({ where: { id: { in: speciesIds } } });
    await prisma.userSession.deleteMany({ where: { user: { personId: { in: staffPersonIds } } } });
    await prisma.userRole.deleteMany({ where: { user: { personId: { in: staffPersonIds } } } });
    await prisma.user.deleteMany({ where: { personId: { in: staffPersonIds } } });
    await prisma.person.deleteMany({ where: { id: { in: [...staffPersonIds, ...clientPersonIds] } } });
    await prisma.rolePermission.deleteMany({ where: { roleId: { in: roleIds } } });
    await prisma.role.deleteMany({ where: { id: { in: roleIds } } });
    await app.close();
  });

  it('inactiva una especie activa y registra la auditoría (escenario 1)', async () => {
    const species = await createSpecies(true);

    const response = await changeStatus(species.id, { isActive: false }).expect(200);

    expect(response.body).toMatchObject({
      success: true,
      message: 'Especie inactivada correctamente',
      data: { id: species.id, name: species.name, isActive: false },
    });
    expect(await isActiveOf(species.id)).toBe(false);
    const logs = await auditOf(species.name);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      userId: actorIdsByRole.get('veterinarian'),
      action: 'Inactivar',
      module: 'Especies',
      previousValue: { status: 'Activa' },
      newValue: { status: 'Inactiva' },
    });
  });

  it('activa una especie inactiva y registra la auditoría (escenario 2)', async () => {
    const species = await createSpecies(false);

    const response = await changeStatus(species.id, { isActive: true }).expect(200);

    expect(response.body).toMatchObject({ message: 'Especie activada correctamente', data: { id: species.id, isActive: true } });
    expect(await isActiveOf(species.id)).toBe(true);
    const logs = await auditOf(species.name);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ action: 'Activar', previousValue: { status: 'Inactiva' }, newValue: { status: 'Activa' } });
  });

  it.each([true, false])('responde con éxito sin auditar si la especie ya tiene isActive=%s', async (isActive) => {
    const species = await createSpecies(isActive);

    const response = await changeStatus(species.id, { isActive }).expect(200);

    expect(response.body.data.isActive).toBe(isActive);
    expect(await auditOf(species.name)).toHaveLength(0);
  });

  it('responde 404 si la especie no existe', async () => {
    const response = await changeStatus(UNKNOWN_ID, { isActive: false }).expect(404);

    expect(response.body.message).toBe('Especie no encontrada');
  });

  it.each([[{ isActive: 'no' }], [{}], [{ isActive: null }]])('rechaza el cuerpo %j (400)', async (body) => {
    const species = await createSpecies(true);

    const response = await changeStatus(species.id, body).expect(400);

    expect(response.body.message).toBe('Estado de especie no válido');
    expect(await isActiveOf(species.id)).toBe(true);
  });

  it('rechaza un identificador que no es UUID (400)', async () => {
    await changeStatus('no-es-uuid', { isActive: false }).expect(400);
  });

  it('exige sesión (401)', async () => {
    const species = await createSpecies(true);

    await changeStatus(species.id, { isActive: false }, null).expect(401);
    expect(await isActiveOf(species.id)).toBe(true);
  });

  // Matriz de roles, sección 2.4: solo el Veterinario activa e inactiva especies.
  it.each(['manager', 'veterinary_technician', 'receptionist'])('rechaza a %s (403)', async (role) => {
    const species = await createSpecies(true);

    const response = await changeStatus(species.id, { isActive: false }, role).expect(403);

    expect(response.body.message).toBe('No tiene permisos para realizar esta acción');
    expect(await isActiveOf(species.id)).toBe(true);
  });

  it('al inactivarla deja de ofrecerse y conserva sus razas y pacientes; al activarla vuelve a estar disponible (escenario 4, R-07)', async () => {
    const species = await createSpecies(true);
    const existingBreed = await registerBreed(species.id, 'Raza existente').expect(201);
    const patient = await createPatient(species.id, existingBreed.body.data.id);
    const patientState = () => prisma.patient.findUniqueOrThrow({
      where: { id: patient.id },
      select: { name: true, speciesId: true, breedId: true, clientId: true, status: true },
    });
    const patientBefore = await patientState();

    await changeStatus(species.id, { isActive: false }).expect(200);

    expect(await activeNames('veterinarian')).not.toContain(species.name);
    const rejected = await registerBreed(species.id).expect(409);
    expect(rejected.body.message).toBe('La especie seleccionada está inactiva');
    const breed = await prisma.breed.findUniqueOrThrow({ where: { id: existingBreed.body.data.id } });
    expect(breed).toMatchObject({ name: 'Raza existente', speciesId: species.id, isActive: true });
    expect(await patientState()).toEqual(patientBefore);

    await changeStatus(species.id, { isActive: true }).expect(200);

    expect(await patientState()).toEqual(patientBefore);

    for (const role of ['veterinarian', 'veterinary_technician', 'receptionist']) {
      expect(await activeNames(role)).toContain(species.name);
    }
    await registerBreed(species.id).expect(201);
  });
});
