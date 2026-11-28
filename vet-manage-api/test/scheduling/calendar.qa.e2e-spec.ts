import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GlobalExceptionFilter } from '../../src/common/errors/global-exception.filter.js';
import configuration from '../../src/config/configuration.js';
import { CancelAppointmentService } from '../../src/modules/scheduling/appointments/services/cancel-appointment.service.js';
import { CalendarModule } from '../../src/modules/scheduling/calendar/calendar.module.js';
import { WorkSchedulesModule } from '../../src/modules/scheduling/work-schedules/work-schedules.module.js';
import { ScheduleBlocksModule } from '../../src/modules/scheduling/schedule-blocks/schedule-blocks.module.js';
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
    CalendarModule,
    WorkSchedulesModule,
    ScheduleBlocksModule,
  ],
})
class AppointmentsE2eModule {}

describe('HU-001 integracion real aislada', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  let receptionistToken: string;
  let _secondReceptionistToken: string;
  let _deniedToken: string;
  let branchId: string;
  let roomId: string;
  let clientId: string;
  let otherClientId: string;
  let patientId: string;
  let _otherPatientId: string;
  let serviceId: string;
  let vetId: string;
  let otherVetId: string;
  let actorId: string;
  const personIds: string[] = [];
  const userIds: string[] = [];
  const roleIds: string[] = [];
  const appointmentIds: string[] = [];
  const _blockIds: string[] = [];
  const scheduleIds: string[] = [];
  const tariffIds: string[] = [];
  const permissionIds: string[] = [];
  let speciesId = '';
  let breedId = '';
  let vetRoleId = '';
  let _vetRoleWasActive = true;
  let _databaseReady = false;
  let counter = 0;
  const suffix = randomUUID();

  async function createPerson(prefix: string) {
    const n = `${Date.now()}${counter++}`;
    const person = await prisma.person.create({
      data: {
        identification: String(
          Math.floor(1_000_000_000 + Math.random() * 8_999_999_999),
        ),
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
    const part = (type: string) =>
      parts.find((item) => item.type === type)?.value ?? '';
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
    return {
      fecha: day.toISOString().slice(0, 10),
      horaInicio: `${String(hour).padStart(2, '0')}:00`,
    };
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
    if (
      !process.env.DATABASE_URL ||
      new URL(process.env.DATABASE_URL).pathname !==
        '/vet_manage_hu001_qa_20261127'
    )
      throw new Error(
        'Esta suite exige base aislada vet_manage_hu001_qa_20261127',
      );
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ||
      'secret-for-testing-only-at-least-32-chars-long';
    process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';

    const moduleRef = await Test.createTestingModule({
      imports: [AppointmentsE2eModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    _databaseReady = true;
    tokens = app.get(TokenService);

    const receptionistRole = await createRole('test_receptionist', [
      'appointments:create',
      'appointments:update',
      'appointments:cancel',
      'calendar:read',
      'work-schedules:manage',
      'schedule-blocks:create',
      'schedule-blocks:remove',
    ]);
    const deniedRole = await createRole('test_without_availability', [
      'rates:read',
    ]);
    actorId = await createUser(receptionistRole.id, 'Recepcionista');
    const secondReceptionistId = await createUser(
      receptionistRole.id,
      'SegundaRecepcionista',
    );
    const deniedUserId = await createUser(deniedRole.id, 'SinPermiso');
    receptionistToken = await tokens.issue(actorId);
    _secondReceptionistToken = await tokens.issue(secondReceptionistId);
    _deniedToken = await tokens.issue(deniedUserId);

    const vetRole = await prisma.role.findUnique({
      where: { name: 'veterinarian' },
    });
    if (vetRole) {
      vetRoleId = vetRole.id;
      _vetRoleWasActive = vetRole.isActive;
      if (!vetRole.isActive) {
        await prisma.role.update({
          where: { id: vetRole.id },
          data: { isActive: true },
        });
      }
    } else {
      const createdVetRole = await prisma.role.create({
        data: {
          name: 'veterinarian',
          displayName: 'Veterinario',
          isActive: true,
        },
      });
      vetRoleId = createdVetRole.id;
      roleIds.push(createdVetRole.id);
    }

    branchId = (
      await prisma.sucursal.create({
        data: { nombre: `Sucursal HU003 ${suffix}` },
      })
    ).id;
    roomId = (
      await prisma.sala.create({
        data: {
          sucursalId: branchId,
          nombre: `Consultorio HU003 ${suffix}`,
          tipo: 'CONSULTORIO',
        },
      })
    ).id;
    const service = await prisma.servicio.create({
      data: { nombre: `Servicio HU003 ${suffix}`, duracionMaximaMin: 60 },
    });
    serviceId = service.id;
    const tariff = await prisma.tarifa.create({
      data: { servicioId: serviceId, sucursalId: branchId, importe: 20 },
    });
    tariffIds.push(tariff.id);

    const species = await prisma.species.create({
      data: { name: `Especie HU003 ${suffix}` },
    });
    speciesId = species.id;
    const breed = await prisma.breed.create({
      data: { name: `Raza HU003 ${suffix}`, speciesId },
    });
    breedId = breed.id;

    const owner = await createPerson('Cliente');
    clientId = (await prisma.client.create({ data: { personId: owner.id } }))
      .id;
    const otherOwner = await createPerson('OtroCliente');
    otherClientId = (
      await prisma.client.create({ data: { personId: otherOwner.id } })
    ).id;
    patientId = (
      await prisma.patient.create({
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
      })
    ).id;
    _otherPatientId = (
      await prisma.patient.create({
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
      })
    ).id;

    vetId = await createUser(vetRoleId, 'Veterinario');
    otherVetId = await createUser(vetRoleId, 'OtroVeterinario');

    // Jornada de lunes a viernes de 08:00 a 20:00 para los dos veterinarios en la sucursal de prueba.
    for (const veterinarioId of [vetId, otherVetId]) {
      for (const diaSemana of [
        'LUNES',
        'MARTES',
        'MIERCOLES',
        'JUEVES',
        'VIERNES',
      ] as const) {
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
    if (app) await app.close();
  });
  async function calendar(fecha: string) {
    const res = await request(app.getHttpServer())
      .get('/scheduling/calendar')
      .query({ sucursalId: branchId, fecha, vista: 'dia' })
      .set('Authorization', `Bearer ${receptionistToken}`)
      .expect(200);
    return res.body.data;
  }
  const estado = (data: any, hora: string) =>
    data.franjas.find((s: any) => s.hora === hora)?.estado;
  it('CP-001-09 HU003 crea cita real y calendario muestra ocupacion', async () => {
    const day = slotAt(10);
    const r = await register(bodyFor(day, { duracionMin: 60 })).expect(201);
    const c = await calendar(day.fecha);
    expect(c.citas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: r.body.data.id,
          estado: 'PROGRAMADA',
          numero: r.body.data.numero,
        }),
      ]),
    );
    expect(estado(c, '10:00')).toBe('Ocupado');
    expect(estado(c, '10:30')).toBe('Ocupado');
  });
  it('CP-001-10 HU004 modifica cita real y libera origen', async () => {
    const old = slotAt(12, 6),
      next = slotAt(11, 7);
    const r = await register(bodyFor(old)).expect(201);
    await prisma.cita.update({
      where: { id: r.body.data.id },
      data: { estado: 'CONFIRMADA' },
    });
    await request(app.getHttpServer())
      .patch(`/scheduling/appointments/${r.body.data.id}`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        fecha: next.fecha,
        horaInicio: next.horaInicio,
        veterinarioId: vetId,
        salaId: roomId,
      })
      .expect(200);
    const origin = await calendar(old.fecha),
      target = await calendar(next.fecha);
    expect(origin.citas.some((c: any) => c.id === r.body.data.id)).toBe(false);
    expect(estado(origin, old.horaInicio)).toBe('Disponible');
    expect(target.citas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: r.body.data.id,
          inicio: `${next.fecha}T16:00:00.000Z`,
          fin: `${next.fecha}T16:30:00.000Z`,
        }),
      ]),
    );
    expect(estado(target, next.horaInicio)).toBe('Ocupado');
  });
  it('CP-001-11 HU005 cancela en PostgreSQL y calendario libera horario', async () => {
    const historical = { fecha: '2026-11-02', horaInicio: '10:00' };
    const r = await createExistingAppointment(historical, vetId);
    await app
      .get(CancelAppointmentService)
      .execute(
        r.id,
        'El cliente no podra asistir',
        actorId,
        new Date('2026-11-01T10:00:00-05:00'),
      );
    const c = await calendar(historical.fecha);
    expect(c.citas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: r.id, estado: 'CANCELADA' }),
      ]),
    );
    expect(estado(c, '10:00')).toBe('Disponible');
  });
  let blockId = '';
  it('CP-001-12 HU007 y HU014 persisten jornada y bloqueo visibles', async () => {
    await prisma.horarioBase.deleteMany({ where: { sucursalId: branchId } });
    await request(app.getHttpServer())
      .post('/scheduling/work-schedules')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        veterinarioId: vetId,
        sucursalId: branchId,
        diaSemana: 'LUNES',
        horaInicio: '08:00',
        horaFin: '12:00',
      })
      .expect(201);
    const b = await request(app.getHttpServer())
      .post('/scheduling/schedule-blocks')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        sucursalId: branchId,
        alcance: 'SUCURSAL',
        fecha: '2026-11-02',
        horaInicio: '11:00',
        horaFin: '11:30',
        motivo: 'Bloqueo exclusivo QA HU001',
      })
      .expect(201);
    blockId = b.body.data.id;
    const c = await calendar('2026-11-02');
    expect(estado(c, '09:00')).toBe('Disponible');
    expect(estado(c, '11:00')).toBe('Bloqueado');
    expect(estado(c, '13:00')).toBe('Fuera de atención');
  });
  it('CP-001-13 HU015 elimina bloqueo real y calendario libera horario', async () => {
    expect(blockId).toBeTruthy();
    await request(app.getHttpServer())
      .patch(`/scheduling/schedule-blocks/${blockId}/remove`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .expect(200);
    expect(estado(await calendar('2026-11-02'), '11:00')).toBe('Disponible');
    expect(
      (
        await prisma.bloqueoHorario.findUniqueOrThrow({
          where: { id: blockId },
        })
      ).fechaEliminacion,
    ).not.toBeNull();
  });
});
