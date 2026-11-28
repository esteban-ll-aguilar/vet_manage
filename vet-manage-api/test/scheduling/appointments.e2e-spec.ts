import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GlobalExceptionFilter } from '../../src/common/errors/global-exception.filter.js';
import configuration from '../../src/config/configuration.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { PrismaModule } from '../../src/infrastructure/database/prisma/prisma.module.js';
import { IdentityModule } from '../../src/modules/identity/identity.module.js';
import { TokenService } from '../../src/modules/identity/services/token.service.js';
import { AppointmentsModule } from '../../src/modules/scheduling/appointments/appointments.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    PrismaModule,
    IdentityModule,
    AppointmentsModule,
  ],
})
class AppointmentsE2eModule {}

describe('HU-003 registrar cita presencial (e2e PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  let receptionistToken: string;
  let secondReceptionistToken: string;
  let deniedToken: string;
  let branchId: string;
  let roomId: string;
  let clientId: string;
  let otherClientId: string;
  let patientId: string;
  let otherPatientId: string;
  let serviceId: string;
  let vetId: string;
  let otherVetId: string;
  let actorId: string;
  const personIds: string[] = [];
  const userIds: string[] = [];
  const roleIds: string[] = [];
  const appointmentIds: string[] = [];
  const blockIds: string[] = [];
  const scheduleIds: string[] = [];
  const tariffIds: string[] = [];
  const permissionIds: string[] = [];
  let speciesId = '';
  let breedId = '';
  let vetRoleId = '';
  let vetRoleWasActive = true;
  let databaseReady = false;
  let counter = 0;
  const suffix = randomUUID();

  async function createPerson(prefix: string) {
    const n = `${Date.now()}${counter++}`;
    const person = await prisma.person.create({
      data: {
        identification: String(Math.floor(1_000_000_000 + Math.random() * 8_999_999_999)),
        firstName: prefix,
        lastName: suffix,
        email: `${prefix}.${n}.${suffix}@appointments-e2e.test`,
      },
    });
    personIds.push(person.id);
    return person;
  }

  async function createRole(name: string, permissionKeys: string[]) {
    const role = await prisma.role.create({
      data: {
        name: `${name}_${suffix.slice(0, 8).replace(/-/g, '')}`,
        displayName: `${name} HU-003`,
        isActive: true,
      },
    });
    roleIds.push(role.id);
    for (const key of permissionKeys) {
      const [module, action] = key.split(':');
      let permission = await prisma.permission.findUnique({
        where: { permission_module_action_key: { module, action } },
      });
      if (!permission) {
        permission = await prisma.permission.create({
          data: { module, action, displayName: key },
        });
        permissionIds.push(permission.id);
      }
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: permission.id },
      });
    }
    return role;
  }

  async function createUser(roleId: string, firstName: string) {
    const person = await createPerson(firstName);
    const user = await prisma.user.create({
      data: {
        personId: person.id,
        status: 'ACTIVE',
        userRoles: { create: { roleId } },
      },
    });
    userIds.push(user.id);
    return user.id;
  }

  function localDateTime(value: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Guayaquil',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(value);
    const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
    return {
      fecha: `${part('year')}-${part('month')}-${part('day')}`,
      horaInicio: `${part('hour')}:${part('minute')}`,
    };
  }

  // Día hábil número `workdaysAhead` desde hoy (de lunes a viernes, dentro de la jornada de prueba).
  function slotAt(hour: number, workdaysAhead = 5) {
    const today = localDateTime(new Date()).fecha;
    const day = new Date(`${today}T00:00:00.000Z`);
    let counted = 0;
    while (counted < workdaysAhead) {
      day.setUTCDate(day.getUTCDate() + 1);
      if (day.getUTCDay() !== 0 && day.getUTCDay() !== 6) counted += 1;
    }
    return { fecha: day.toISOString().slice(0, 10), horaInicio: `${String(hour).padStart(2, '0')}:00` };
  }

  function bodyFor(
    horario: ReturnType<typeof slotAt>,
    overrides: Record<string, unknown> = {},
  ) {
    return {
      sucursalId: branchId,
      clienteId: clientId,
      pacienteId: patientId,
      servicioId: serviceId,
      veterinarioId: vetId,
      salaId: roomId,
      fecha: horario.fecha,
      horaInicio: horario.horaInicio,
      duracionMin: 30,
      ...overrides,
    };
  }

  async function createExistingAppointment(
    horario: ReturnType<typeof slotAt>,
    veterinarianId: string,
    room = roomId,
  ) {
    const start = new Date(`${horario.fecha}T${horario.horaInicio}:00.000Z`);
    const record = await prisma.cita.create({
      data: {
        estado: 'PROGRAMADA',
        fechaHora: start,
        fechaHoraFin: new Date(start.getTime() + 30 * 60_000),
        importeReserva: 20,
        pacienteId: patientId,
        salaId: room,
        servicioId: serviceId,
        veterinarioId: veterinarianId,
        registradaPorId: actorId,
      },
    });
    appointmentIds.push(record.id);
    return record;
  }

  function register(body: object, token = receptionistToken) {
    return request(app.getHttpServer())
      .post('/scheduling/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL ||
      'postgresql://vetmanage:vetmanage_dev_password@localhost:55432/vet_manage?schema=public';
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'secret-for-testing-only-at-least-32-chars-long';
    process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';

    const moduleRef = await Test.createTestingModule({
      imports: [AppointmentsE2eModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }));
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    databaseReady = true;
    tokens = app.get(TokenService);

    const receptionistRole = await createRole('test_receptionist', ['appointments:create']);
    const deniedRole = await createRole('test_without_availability', ['rates:read']);
    actorId = await createUser(receptionistRole.id, 'Recepcionista');
    const secondReceptionistId = await createUser(receptionistRole.id, 'SegundaRecepcionista');
    const deniedUserId = await createUser(deniedRole.id, 'SinPermiso');
    receptionistToken = await tokens.issue(actorId);
    secondReceptionistToken = await tokens.issue(secondReceptionistId);
    deniedToken = await tokens.issue(deniedUserId);

    const vetRole = await prisma.role.findUnique({ where: { name: 'veterinarian' } });
    if (vetRole) {
      vetRoleId = vetRole.id;
      vetRoleWasActive = vetRole.isActive;
      if (!vetRole.isActive) {
        await prisma.role.update({ where: { id: vetRole.id }, data: { isActive: true } });
      }
    } else {
      const createdVetRole = await prisma.role.create({
        data: { name: 'veterinarian', displayName: 'Veterinario', isActive: true },
      });
      vetRoleId = createdVetRole.id;
      roleIds.push(createdVetRole.id);
    }

    branchId = (await prisma.sucursal.create({ data: { nombre: `Sucursal HU003 ${suffix}` } })).id;
    roomId = (await prisma.sala.create({
      data: { sucursalId: branchId, nombre: `Consultorio HU003 ${suffix}`, tipo: 'CONSULTORIO' },
    })).id;
    const service = await prisma.servicio.create({
      data: { nombre: `Servicio HU003 ${suffix}`, duracionMaximaMin: 60 },
    });
    serviceId = service.id;
    const tariff = await prisma.tarifa.create({
      data: { servicioId: serviceId, sucursalId: branchId, importe: 20 },
    });
    tariffIds.push(tariff.id);

    const species = await prisma.species.create({ data: { name: `Especie HU003 ${suffix}` } });
    speciesId = species.id;
    const breed = await prisma.breed.create({
      data: { name: `Raza HU003 ${suffix}`, speciesId },
    });
    breedId = breed.id;

    const owner = await createPerson('Cliente');
    clientId = (await prisma.client.create({ data: { personId: owner.id } })).id;
    const otherOwner = await createPerson('OtroCliente');
    otherClientId = (await prisma.client.create({ data: { personId: otherOwner.id } })).id;
    patientId = (await prisma.patient.create({
      data: {
        name: `Paciente HU003 ${suffix}`,
        gender: 'FEMALE',
        birthDate: new Date('2020-01-01T00:00:00.000Z'),
        weightKg: 10,
        heightCm: 40,
        reproductiveStatus: 'UNKNOWN',
        clientId,
        speciesId,
        breedId,
      },
    })).id;
    otherPatientId = (await prisma.patient.create({
      data: {
        name: `Paciente otro cliente HU003 ${suffix}`,
        gender: 'MALE',
        birthDate: new Date('2021-01-01T00:00:00.000Z'),
        weightKg: 8,
        heightCm: 30,
        reproductiveStatus: 'UNKNOWN',
        clientId: otherClientId,
        speciesId,
        breedId,
      },
    })).id;

    vetId = await createUser(vetRoleId, 'Veterinario');
    otherVetId = await createUser(vetRoleId, 'OtroVeterinario');

    // Jornada de lunes a viernes de 08:00 a 20:00 para los dos veterinarios en la sucursal de prueba.
    for (const veterinarioId of [vetId, otherVetId]) {
      for (const diaSemana of ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'] as const) {
        const schedule = await prisma.horarioBase.create({
          data: {
            veterinarioId,
            sucursalId: branchId,
            diaSemana,
            horaInicio: new Date('1970-01-01T08:00:00.000Z'),
            horaFin: new Date('1970-01-01T20:00:00.000Z'),
          },
        });
        scheduleIds.push(schedule.id);
      }
    }
  });

  afterAll(async () => {
    if (!prisma) return;
    if (!databaseReady) {
      await app.close();
      return;
    }
    if (vetRoleId && !roleIds.includes(vetRoleId)) {
      await prisma.role.update({ where: { id: vetRoleId }, data: { isActive: vetRoleWasActive } });
    }
    await prisma.cita.deleteMany({ where: { id: { in: appointmentIds } } });
    await prisma.bloqueoHorario.deleteMany({ where: { id: { in: blockIds } } });
    await prisma.horarioBase.deleteMany({ where: { id: { in: scheduleIds } } });
    await prisma.tarifa.deleteMany({ where: { id: { in: tariffIds } } });
    const patientIds = [patientId, otherPatientId].filter((id): id is string => Boolean(id));
    if (patientIds.length > 0) {
      await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
    }
    if (breedId) await prisma.breed.deleteMany({ where: { id: breedId } });
    if (speciesId) await prisma.species.deleteMany({ where: { id: speciesId } });
    const clientIds = [clientId, otherClientId].filter((id): id is string => Boolean(id));
    if (clientIds.length > 0) {
      await prisma.client.deleteMany({ where: { id: { in: clientIds } } });
    }
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.role.deleteMany({ where: { id: { in: roleIds } } });
    await prisma.permission.deleteMany({ where: { id: { in: permissionIds } } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
    if (serviceId) await prisma.servicio.deleteMany({ where: { id: serviceId } });
    if (roomId) await prisma.sala.deleteMany({ where: { id: roomId } });
    if (branchId) await prisma.sucursal.deleteMany({ where: { id: branchId } });
    await app.close();
  });

  it('CP-003-01 registra cita con fin, tarifa, estado y número únicos', async () => {
    const horario = slotAt(10);
    const response = await register(bodyFor(horario, { duracionMin: 60 })).expect(201);
    appointmentIds.push(response.body.data.id as string);

    expect(response.body.message).toBe('Cita registrada');
    expect(response.body.data).toMatchObject({
      numero: expect.any(Number),
      estado: 'PROGRAMADA',
      importeReserva: '20',
    });
    expect(new Date(response.body.data.fechaHora).getTime())
      .toBe(new Date(`${horario.fecha}T10:00:00.000Z`).getTime());
    expect(new Date(response.body.data.fechaHoraFin).getTime())
      .toBe(new Date(`${horario.fecha}T11:00:00.000Z`).getTime());
    expect(new Date(response.body.data.fechaHoraFin).getTime() -
      new Date(response.body.data.fechaHora).getTime()).toBe(60 * 60_000);
    expect(response.body.data.numero).toBeGreaterThan(0);

    const anotherAppointment = await register(bodyFor(slotAt(13))).expect(201);
    appointmentIds.push(anotherAppointment.body.data.id as string);
    expect(anotherAppointment.body.data.numero).not.toBe(response.body.data.numero);
  });

  it('CP-003-02 rechaza y detalla todos los campos obligatorios faltantes', async () => {
    const response = await register({}).expect(400);

    for (const field of [
      'sucursalId', 'clienteId', 'pacienteId', 'servicioId', 'veterinarioId',
      'salaId', 'fecha', 'horaInicio', 'duracionMin',
    ]) {
      if (field === 'duracionMin') {
        expect(response.body.message).toContain('La duración es obligatoria');
      } else {
        expect(response.body.message).toContain(field);
      }
    }
  });

  it('CP-003-03 rechaza un veterinario ocupado', async () => {
    const horario = slotAt(10, 6);
    await createExistingAppointment(horario, vetId);

    const response = await register(bodyFor(horario)).expect(409);

    expect(response.body.message).toBe('Veterinario no disponible');
  });

  it('CP-003-04 rechaza un consultorio ocupado por otro veterinario', async () => {
    const horario = slotAt(11);
    await createExistingAppointment(horario, otherVetId);

    const response = await register(bodyFor(horario)).expect(409);

    expect(response.body.message).toBe('Consultorio no disponible');
  });

  it('CP-003-05 rechaza un horario bloqueado sin insertar la cita', async () => {
    const horario = slotAt(12);
    const block = await prisma.bloqueoHorario.create({
      data: {
        sucursalId: branchId,
        veterinarioId: vetId,
        fecha: new Date(`${horario.fecha}T00:00:00.000Z`),
        horaInicio: new Date(`1970-01-01T${horario.horaInicio}:00.000Z`),
        horaFin: new Date(`1970-01-01T12:30:00.000Z`),
        motivo: 'Prueba HU-003',
        registradoPorId: actorId,
      },
    });
    blockIds.push(block.id);
    const before = await prisma.cita.count();

    const response = await register(bodyFor(horario)).expect(409);

    expect(response.body.message).toBe('Horario bloqueado');
    expect(await prisma.cita.count()).toBe(before);
  });

  it('CP-003-06 rechaza fecha y hora iguales o anteriores al momento actual', async () => {
    // Como en la HU: un día anterior a las 10:00.
    const past = { fecha: localDateTime(new Date(Date.now() - 24 * 60 * 60_000)).fecha, horaInicio: '10:00' };
    const response = await register(bodyFor(past)).expect(400);

    expect(response.body.message).toBe('La fecha y hora deben ser posteriores al momento actual');
  });

  it('CP-003-07 serializa dos solicitudes concurrentes con Promise.all', async () => {
    const horario = slotAt(10, 7);
    const attempts = await Promise.all([
      register(bodyFor(horario)),
      register(bodyFor(horario), secondReceptionistToken),
    ]);
    const succeeded = attempts.filter((response) => response.status === 201);
    const rejected = attempts.filter((response) => response.status === 409);

    expect(succeeded).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    appointmentIds.push(succeeded[0].body.data.id as string);
    expect(rejected[0].body.message).toBe('Veterinario no disponible');
    expect(await prisma.cita.count({
      where: {
        veterinarioId: vetId,
        fechaHora: new Date(`${horario.fecha}T${horario.horaInicio}:00.000Z`),
      },
    })).toBe(1);
  });

  it('CP-003-08 rechaza un paciente que pertenece a otro cliente', async () => {
    const response = await register(bodyFor(slotAt(14), {
      pacienteId: otherPatientId,
    })).expect(400);

    expect(response.body.message).toBe('El paciente no pertenece al cliente');
  });

  it('CP-003-09 rechaza duración menor a 30 o superior al máximo del servicio', async () => {
    const tooLong = await register(bodyFor(slotAt(15), { duracionMin: 90 })).expect(400);
    const tooShort = await register(bodyFor(slotAt(16), { duracionMin: 20 })).expect(400);

    expect(tooLong.body.message).toBe(
      'La duración debe ser de al menos 30 minutos y no superar el máximo permitido para el servicio',
    );
    expect(tooShort.body.message).toContain(
      'La duración debe ser de al menos 30 minutos y no superar el máximo permitido para el servicio',
    );
  });

  it('responde 401 sin sesión y 403 sin appointments:create', async () => {
    const body = bodyFor(slotAt(17));
    await request(app.getHttpServer()).post('/scheduling/appointments').send(body).expect(401);
    const denied = await register(body, deniedToken).expect(403);

    expect(denied.body.message).toBe('No tiene permisos para realizar esta acción');
  });
});
