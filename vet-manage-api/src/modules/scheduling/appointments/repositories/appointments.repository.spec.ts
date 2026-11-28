import 'reflect-metadata';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { validateSync } from 'class-validator';
import type { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import { RegisterAppointmentDto } from '../dtos/register-appointment.dto.js';
import {
  APPOINTMENT_MESSAGES,
  AppointmentsRepository,
} from './appointments.repository.js';

const ids = {
  branch: '00000000-0000-4000-8000-000000000001',
  client: '00000000-0000-4000-8000-000000000002',
  patient: '00000000-0000-4000-8000-000000000003',
  service: '00000000-0000-4000-8000-000000000004',
  vet: '00000000-0000-4000-8000-000000000005',
  room: '00000000-0000-4000-8000-000000000006',
  actor: '00000000-0000-4000-8000-000000000007',
};

const request = {
  sucursalId: ids.branch,
  clienteId: ids.client,
  pacienteId: ids.patient,
  servicioId: ids.service,
  veterinarioId: ids.vet,
  salaId: ids.room,
  fecha: '2030-01-02',
  horaInicio: '10:00',
  duracionMin: 30,
} satisfies RegisterAppointmentDto;

type MockAppointment = {
  veterinarioId: string;
  salaId: string;
  fechaHora: Date;
  fechaHoraFin: Date;
  estado: string;
};

function createHarness(options: {
  patientClientId?: string;
  patientStatus?: string;
  serviceMaxDuration?: number;
  blocked?: boolean;
  conflicts?: MockAppointment[];
  sharedAppointments?: MockAppointment[];
  serializeLocks?: boolean;
  outsideWorkingHours?: boolean;
} = {}) {
  const sharedAppointments = options.sharedAppointments ?? options.conflicts ?? [];
  const lockTails = new Map<string, Promise<void>>();
  const createTransaction = () => {
    const releases: (() => void)[] = [];
    const tx = {
      $queryRaw: vi.fn(async (query: TemplateStringsArray, lockKey: string) => {
        expect(query.join(' ')).toContain('pg_advisory_xact_lock');
        if (options.serializeLocks) {
          const previous = lockTails.get(lockKey) ?? Promise.resolve();
          let release = () => {};
          const held = new Promise<void>((resolve) => {
            release = resolve;
          });
          lockTails.set(lockKey, previous.then(() => held));
          await previous;
          releases.push(release);
        }
        return [];
      }),
      patient: {
        findUnique: vi.fn().mockResolvedValue({
          id: ids.patient,
          clientId: options.patientClientId ?? ids.client,
          status: options.patientStatus ?? 'ACTIVE',
        }),
      },
      client: { findFirst: vi.fn().mockResolvedValue({ id: ids.client }) },
      sucursal: { findFirst: vi.fn().mockResolvedValue({ id: ids.branch }) },
      sala: { findFirst: vi.fn().mockResolvedValue({ id: ids.room }) },
      servicio: {
        findFirst: vi.fn().mockResolvedValue({
          id: ids.service,
          duracionMaximaMin: options.serviceMaxDuration ?? 60,
        }),
      },
      user: { findFirst: vi.fn().mockResolvedValue({ id: ids.vet }) },
      tarifa: { findFirst: vi.fn().mockResolvedValue({ importe: 20 }) },
      // Jornada del veterinario: miércoles de 08:00 a 16:00, sin disponibilidad diaria registrada.
      horarioBase: {
        findMany: vi.fn().mockResolvedValue(options.outsideWorkingHours ? [] : [{
          id: 'schedule-1',
          horaInicio: new Date('1970-01-01T08:00:00.000Z'),
          horaFin: new Date('1970-01-01T16:00:00.000Z'),
        }]),
      },
      turnoSabado: { findUnique: vi.fn().mockResolvedValue(null) },
      disponibilidadDiaria: { findMany: vi.fn().mockResolvedValue([]) },
      bloqueoHorario: {
        findFirst: vi.fn().mockResolvedValue(options.blocked ? { id: 'block' } : null),
      },
      cita: {
        findMany: vi.fn().mockImplementation(async () => sharedAppointments),
        create: vi.fn().mockImplementation(async ({ data }) => {
          const created = {
            ...data,
            numero: sharedAppointments.length + 100,
            estado: 'PROGRAMADA',
          };
          sharedAppointments.push(created);
          return {
            id: `appointment-${created.numero}`,
            numero: created.numero,
            fechaHora: created.fechaHora,
            fechaHoraFin: created.fechaHoraFin,
            estado: created.estado,
            importeReserva: created.importeReserva,
          };
        }),
      },
    };

    return { tx, releases };
  };

  const prisma = {
    $transaction: vi.fn(async (callback: (tx: ReturnType<typeof createTransaction>['tx']) => unknown) => {
      const { tx, releases } = createTransaction();
      try {
        return await callback(tx);
      } finally {
        releases.reverse().forEach((release) => release());
      }
    }),
  };
  const repository = new AppointmentsRepository(prisma as unknown as PrismaService);
  return { repository, prisma, sharedAppointments };
}

describe('AppointmentsRepository - HU-003', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T10:00:00-05:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('CP-003-02 rechaza el formulario sin los campos obligatorios', () => {
    const validationErrors = validateSync(new RegisterAppointmentDto());
    const invalidFields = validationErrors.map(({ property }) => property);

    expect(invalidFields).toEqual(expect.arrayContaining([
      'sucursalId',
      'clienteId',
      'pacienteId',
      'servicioId',
      'veterinarioId',
      'salaId',
      'fecha',
      'horaInicio',
      'duracionMin',
    ]));
  });

  it('CP-003-08 rechaza un paciente que no pertenece al cliente', async () => {
    const { repository } = createHarness({ patientClientId: ids.branch });

    await expect(repository.register(request, ids.actor)).rejects.toMatchObject({
      message: APPOINTMENT_MESSAGES.patientDoesNotBelong,
    });
  });

  it('CP-003-06 rechaza una fecha y hora que no son futuras', async () => {
    const { repository } = createHarness();

    await expect(repository.register({
      ...request,
      fecha: '2030-01-01',
      horaInicio: '10:00',
    }, ids.actor)).rejects.toMatchObject({
      message: APPOINTMENT_MESSAGES.mustBeFuture,
    });
  });

  it('CP-003-09 rechaza duraciones inferiores a 30 o superiores al servicio', async () => {
    const { repository } = createHarness({ serviceMaxDuration: 60 });

    await expect(repository.register({ ...request, duracionMin: 90 }, ids.actor))
      .rejects.toMatchObject({ message: APPOINTMENT_MESSAGES.invalidDuration });
    await expect(repository.register({ ...request, duracionMin: 29 }, ids.actor))
      .rejects.toMatchObject({ message: APPOINTMENT_MESSAGES.invalidDuration });
  });

  it('rechaza duraciones y horas fuera de los períodos de 30 minutos', async () => {
    const { repository } = createHarness({ serviceMaxDuration: 60 });

    await expect(repository.register({ ...request, duracionMin: 45 }, ids.actor))
      .rejects.toMatchObject({ message: APPOINTMENT_MESSAGES.invalidDuration });
    await expect(repository.register({ ...request, horaInicio: '10:15' }, ids.actor))
      .rejects.toMatchObject({ message: APPOINTMENT_MESSAGES.notOnSlot });
  });

  it('rechaza un horario fuera de la jornada del veterinario con un mensaje que lo indica', async () => {
    const { repository } = createHarness({ outsideWorkingHours: true });

    await expect(repository.register(request, ids.actor)).rejects.toMatchObject({
      message: APPOINTMENT_MESSAGES.outsideWorkingHours,
    });
  });

  it('CP-003-05 rechaza un intervalo con bloqueo activo', async () => {
    const { repository } = createHarness({ blocked: true });

    await expect(repository.register(request, ids.actor)).rejects.toMatchObject({
      message: APPOINTMENT_MESSAGES.blocked,
    });
  });

  it('CP-003-03 rechaza la superposición de citas del veterinario', async () => {
    const { repository } = createHarness({
      conflicts: [{
        veterinarioId: ids.vet,
        salaId: 'other-room',
        fechaHora: new Date('2030-01-02T10:00:00.000Z'),
        fechaHoraFin: new Date('2030-01-02T10:30:00.000Z'),
        estado: 'PROGRAMADA',
      }],
    });

    await expect(repository.register(request, ids.actor)).rejects.toMatchObject({
      message: APPOINTMENT_MESSAGES.veterinarianUnavailable,
    });
  });

  it('CP-003-04 rechaza la superposición de citas del consultorio', async () => {
    const { repository } = createHarness({
      conflicts: [{
        veterinarioId: 'other-vet',
        salaId: ids.room,
        fechaHora: new Date('2030-01-02T10:00:00.000Z'),
        fechaHoraFin: new Date('2030-01-02T10:30:00.000Z'),
        estado: 'PROGRAMADA',
      }],
    });

    await expect(repository.register(request, ids.actor)).rejects.toMatchObject({
      message: APPOINTMENT_MESSAGES.roomUnavailable,
    });
  });

  it('CP-003-07 permite solo una reserva concurrente y no deja una cita parcial', async () => {
    const { repository, sharedAppointments } = createHarness({ serializeLocks: true });

    const attempts = await Promise.allSettled([
      repository.register(request, ids.actor),
      repository.register(request, ids.actor),
    ]);

    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);
    const failed = attempts.find((attempt) => attempt.status === 'rejected');
    expect(failed).toMatchObject({
      reason: { message: APPOINTMENT_MESSAGES.veterinarianUnavailable },
    });
    expect(sharedAppointments).toHaveLength(1);
  });

  it('CP-003-01 guarda fin, tarifa, estado y número único al registrar correctamente', async () => {
    const { repository } = createHarness();

    const appointment = await repository.register(request, ids.actor);

    expect(appointment).toMatchObject({
      numero: 100,
      estado: 'PROGRAMADA',
      importeReserva: 20,
      fechaHora: new Date('2030-01-02T10:00:00.000Z'),
      fechaHoraFin: new Date('2030-01-02T10:30:00.000Z'),
    });
  });
});
