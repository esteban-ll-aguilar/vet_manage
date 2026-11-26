
import { describe, expect, it, vi } from 'vitest';
import { ResourcesRepository } from './resources.repository.js';

const FECHA = new Date('2026-11-02T00:00:00.000Z');
const INICIO = new Date('2026-11-02T10:00:00.000Z');
const FIN = new Date('2026-11-02T10:30:00.000Z');

function build() {
  const userFindMany = vi.fn(async () => []);
  const salaFindMany = vi.fn(async () => []);
  const horarioBaseFindMany = vi.fn(async () => []);
  const disponibilidadDiariaFindMany = vi.fn(async () => []);
  const turnoSabadoFindUnique = vi.fn(async () => null);
  const citaFindMany = vi.fn(async () => []);
  const bloqueoHorarioFindMany = vi.fn(async () => []);

  const prisma = {
    user: { findMany: userFindMany },
    sala: { findMany: salaFindMany },
    horarioBase: { findMany: horarioBaseFindMany },
    disponibilidadDiaria: {
      findMany: disponibilidadDiariaFindMany,
    },
    turnoSabado: {
      findUnique: turnoSabadoFindUnique,
    },
    cita: { findMany: citaFindMany },
    bloqueoHorario: {
      findMany: bloqueoHorarioFindMany,
    },
  };

  return {
    repository: new ResourcesRepository(prisma as never),
    userFindMany,
    salaFindMany,
    horarioBaseFindMany,
    disponibilidadDiariaFindMany,
    turnoSabadoFindUnique,
    citaFindMany,
    bloqueoHorarioFindMany,
  };
}

describe('ResourcesRepository - HU-006', () => {
  it('consulta veterinarios activos con rol veterinario', async () => {
    const { repository, userFindMany } = build();

    await repository.findActiveVeterinarians();

    expect(userFindMany).toHaveBeenCalledWith({
      where: {
        status: 'ACTIVE',
        userRoles: {
          some: {
            role: {
              name: 'veterinarian',
              isActive: true,
            },
          },
        },
      },
      select: {
        id: true,
        person: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [
        { person: { lastName: 'asc' } },
        { person: { firstName: 'asc' } },
      ],
    });
  });

  it('consulta consultorios activos de Loja', async () => {
    const { repository, salaFindMany } = build();

    await repository.findActiveRooms('suc-loja');

    expect(salaFindMany).toHaveBeenCalledWith({
      where: {
        sucursalId: 'suc-loja',
        tipo: 'CONSULTORIO',
        estado: true,
      },
      select: {
        id: true,
        nombre: true,
      },
      orderBy: {
        nombre: 'asc',
      },
    });
  });

  it('consulta horarios activos del lunes en la sucursal', async () => {
    const { repository, horarioBaseFindMany } = build();

    await repository.findActiveWorkSchedules(
      'suc-loja',
      'LUNES',
    );

    expect(horarioBaseFindMany).toHaveBeenCalledWith({
      where: {
        sucursalId: 'suc-loja',
        diaSemana: 'LUNES',
        estado: true,
      },
      orderBy: [
        { horaInicio: 'asc' },
        { veterinarioId: 'asc' },
      ],
    });
  });

  it('consulta franjas diarias del horario seleccionado', async () => {
    const {
      repository,
      disponibilidadDiariaFindMany,
    } = build();

    await repository.findDailyAvailability(
      'base-1',
      FECHA,
    );

    expect(
      disponibilidadDiariaFindMany,
    ).toHaveBeenCalledWith({
      where: {
        horarioBaseId: 'base-1',
        fecha: FECHA,
      },
      orderBy: {
        horaInicio: 'asc',
      },
    });
  });

  it('consulta el turno asignado para un sábado', async () => {
    const { repository, turnoSabadoFindUnique } =
      build();

    await repository.findSaturdayShift(
      'suc-loja',
      FECHA,
    );

    expect(
      turnoSabadoFindUnique,
    ).toHaveBeenCalledWith({
      where: {
        sucursalId_fecha: {
          sucursalId: 'suc-loja',
          fecha: FECHA,
        },
      },
    });
  });

  it('consulta citas superpuestas de la sucursal y de los veterinarios candidatos', async () => {
    const { repository, citaFindMany } = build();

    await repository.findAppointmentsInRange(
      'suc-loja',
      INICIO,
      FIN,
      ['vet-1', 'vet-2'],
    );

    expect(citaFindMany).toHaveBeenCalledWith({
      where: {
        fechaHora: {
          lt: FIN,
        },
        fechaHoraFin: {
          gt: INICIO,
        },
        OR: [
          {
            sala: {
              sucursalId: 'suc-loja',
            },
          },
          {
            veterinarioId: {
              in: ['vet-1', 'vet-2'],
            },
          },
        ],
      },
      select: {
        id: true,
        veterinarioId: true,
        salaId: true,
        estado: true,
        fechaHora: true,
        fechaHoraFin: true,
        sala: {
          select: {
            sucursalId: true,
          },
        },
      },
    });
  });

  it('consulta solamente bloqueos no eliminados de la sucursal', async () => {
    const { repository, bloqueoHorarioFindMany } =
      build();

    await repository.findActiveScheduleBlocks(
      'suc-loja',
      FECHA,
    );

    expect(
      bloqueoHorarioFindMany,
    ).toHaveBeenCalledWith({
      where: {
        sucursalId: 'suc-loja',
        fecha: FECHA,
        fechaEliminacion: null,
      },
      select: {
        id: true,
        veterinarioId: true,
        horaInicio: true,
        horaFin: true,
      },
      orderBy: {
        horaInicio: 'asc',
      },
    });
  });
});
