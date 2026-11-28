import { randomUUID, randomInt } from 'node:crypto';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';

import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { AppointmentsRepository } from '../../src/modules/scheduling/appointments/repositories/appointments.repository.js';
import { CancelAppointmentService } from '../../src/modules/scheduling/appointments/services/cancel-appointment.service.js';
import { CANCELLATION_MESSAGES as M } from '../../src/modules/scheduling/appointments/services/cancellation-rules.js';

describe('HU-005 - Cancelación de citas con PostgreSQL', () => {
  let prisma: PrismaService;
  let service: CancelAppointmentService;

  let patientId: string;
  let roomId: string;
  let vetId: string;
  let receptionistId: string;

  const suffix = randomUUID();
  const NOW = new Date('2026-11-01T10:00:00-05:00');
  const REASON = 'El cliente no podrá asistir';

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;

    if (
      !databaseUrl ||
      new URL(databaseUrl).pathname !== '/vet_manage_hu005_integration'
    ) {
      throw new Error(
        'Las pruebas requieren la base dedicada vet_manage_hu005_integration',
      );
    }

    process.env.NODE_ENV = 'test';

    prisma = new PrismaService();
    await prisma.$connect();

    service = new CancelAppointmentService(
      new AppointmentsRepository(prisma),
    );

    async function createPerson(name: string) {
      return prisma.person.create({
        data: {
          identification: String(
            randomInt(1000000000, 9999999999),
          ),
          firstName: name,
          lastName: suffix,
          email: `${name}-${suffix}@example.test`,
        },
      });
    }

    const branch = await prisma.sucursal.create({
      data: { nombre: `Sucursal HU005 ${suffix}` },
    });

    const room = await prisma.sala.create({
      data: {
        sucursalId: branch.id,
        nombre: `Consultorio HU005 ${suffix}`,
      },
    });

    roomId = room.id;

    const vetPerson = await createPerson('Veterinario');

    const vet = await prisma.user.create({
      data: { personId: vetPerson.id },
    });

    vetId = vet.id;

    const receptionistPerson =
      await createPerson('Recepcionista');

    const receptionist = await prisma.user.create({
      data: { personId: receptionistPerson.id },
    });

    receptionistId = receptionist.id;

    const owner = await createPerson('Cliente');

    const client = await prisma.client.create({
      data: { personId: owner.id },
    });

    const species = await prisma.species.create({
      data: { name: `Especie ${suffix}` },
    });

    const breed = await prisma.breed.create({
      data: {
        name: `Raza ${suffix}`,
        speciesId: species.id,
      },
    });

    const patient = await prisma.patient.create({
      data: {
        name: `Paciente ${suffix}`,
        gender: 'FEMALE',
        birthDate: new Date('2020-01-01T00:00:00.000Z'),
        weightKg: 10,
        heightCm: 40,
        reproductiveStatus: 'UNKNOWN',
        clientId: client.id,
        speciesId: species.id,
        breedId: breed.id,
      },
    });

    patientId = patient.id;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  type TestStatus =
    | 'PROGRAMADA'
    | 'EN_CURSO'
    | 'FINALIZADA'
    | 'CANCELADA'
    | 'NO_ASISTIO';

  async function appointment(
    estado: TestStatus = 'PROGRAMADA',
    paid = false,
  ) {
    const created = await prisma.cita.create({
      data: {
        estado,
        fechaHora: new Date('2026-11-02T10:00:00.000Z'),
        fechaHoraFin: new Date('2026-11-02T10:30:00.000Z'),
        importeReserva: paid ? 20 : 0,
        motivo: 'Consulta veterinaria',
        pacienteId: patientId,
        salaId: roomId,
        veterinarioId: vetId,
        registradaPorId: receptionistId,
      },
    });

    if (paid) {
      await prisma.pago.create({
        data: {
          citaId: created.id,
          referencia: `HU005-${randomUUID()}`,
          importe: 20,
          metodo: 'EFECTIVO',
          canal: 'RECEPCION',
          estado: 'APROBADO',
          registradoPorId: receptionistId,
        },
      });
    }

    return created;
  }

  async function verifyUnchanged(
    id: string,
    estado: TestStatus,
  ) {
    const current = await prisma.cita.findUniqueOrThrow({
      where: { id },
    });

    expect(current.estado).toBe(estado);

    expect(
      await prisma.cambioEstadoCita.count({
        where: { citaId: id },
      }),
    ).toBe(0);

    expect(
      await prisma.notificacionCita.count({
        where: { citaId: id },
      }),
    ).toBe(0);
  }

  it('CP-005-01: cancela exactamente 24 horas antes', async () => {
    const cita = await appointment();

    await service.execute(
      cita.id,
      REASON,
      receptionistId,
      NOW,
    );

    const current = await prisma.cita.findUniqueOrThrow({
      where: { id: cita.id },
    });

    expect(current.estado).toBe('CANCELADA');
    expect(current.tipoCancelacion).toBe('ORDINARIA');
    expect(current.motivo).toBe('Consulta veterinaria');

    const history = await prisma.cambioEstadoCita.findMany({
      where: { citaId: cita.id },
    });

    expect(history).toHaveLength(1);

    expect(history[0]).toMatchObject({
      estadoAnterior: 'PROGRAMADA',
      estadoNuevo: 'CANCELADA',
      motivo: REASON,
      realizadoPorId: receptionistId,
      fechaHora: NOW,
    });

    const notices = await prisma.notificacionCita.findMany({
      where: { citaId: cita.id },
    });

    expect(notices).toHaveLength(1);

    expect(notices[0]).toMatchObject({
      tipo: 'CANCELACION',
      estado: 'PENDIENTE',
    });
  });

  it('CP-005-02: rechaza con 23 horas y 59 minutos', async () => {
    const cita = await appointment();

    const now = new Date('2026-11-01T10:01:00-05:00');

    await expect(
      service.execute(cita.id, REASON, receptionistId, now),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: M.insufficientTime,
    });

    await verifyUnchanged(cita.id, 'PROGRAMADA');
  });

  it.each([
    ['CP-005-03', ''],
    ['CP-005-04', '   '],
  ])('%s: rechaza motivo inválido', async (_, reason) => {
    const cita = await appointment();

    await expect(
      service.execute(cita.id, reason, receptionistId, NOW),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: M.requiredReason,
    });

    await verifyUnchanged(cita.id, 'PROGRAMADA');
  });

  it('CP-005-05: rechaza una cita con pago aprobado', async () => {
    const cita = await appointment('PROGRAMADA', true);

    await expect(
      service.execute(cita.id, REASON, receptionistId, NOW),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: M.approvedPayment,
    });

    await verifyUnchanged(cita.id, 'PROGRAMADA');

    expect(
      await prisma.pago.count({
        where: {
          citaId: cita.id,
          estado: 'APROBADO',
        },
      }),
    ).toBe(1);
  });

  const invalidStates = [
    ['CP-005-06', 'EN_CURSO'],
    ['CP-005-07', 'FINALIZADA'],
    ['CP-005-08', 'CANCELADA'],
    ['CP-005-09', 'NO_ASISTIO'],
  ] as const;

  it.each(invalidStates)(
    '%s: rechaza el estado %s',
    async (_, estado) => {
      const cita = await appointment(estado);

      await expect(
        service.execute(
          cita.id,
          REASON,
          receptionistId,
          NOW,
        ),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: M.invalidStatus,
      });

      await verifyUnchanged(cita.id, estado);
    },
  );
});
