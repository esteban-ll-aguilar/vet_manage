
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { minutesToDbTime } from '../../common/time-slots.js';
import { ResourcesService } from './resources.service.js';

const FECHA = '2026-11-02';
const SUCURSAL = 'suc-loja';

const consulta = (
  overrides: Record<string, unknown> = {},
) => ({
  sucursalId: SUCURSAL,
  fecha: FECHA,
  hora: '10:00',
  duracionMin: 30,
  ...overrides,
});

const veterinario = (
  id: string,
  nombre: string,
) => ({
  id,
  person: {
    firstName: nombre,
    lastName: 'Prueba',
  },
});

const consultorio = (
  id: string,
  nombre: string,
) => ({
  id,
  nombre,
});

const horario = (
  id: string,
  veterinarioId: string,
) => ({
  id,
  veterinarioId,
  sucursalId: SUCURSAL,
  diaSemana: 'LUNES',
  horaInicio: minutesToDbTime(8 * 60),
  horaFin: minutesToDbTime(12 * 60),
  estado: true,
});

const cita = (
  veterinarioId: string,
  salaId: string,
  sucursalId: string = SUCURSAL,
) => ({
  id: 'cita-1',
  veterinarioId,
  salaId,
  estado: 'CONFIRMADA',
  fechaHora: new Date('2026-11-02T10:00:00.000Z'),
  fechaHoraFin: new Date('2026-11-02T10:30:00.000Z'),
  sala: {
    sucursalId,
  },
});

function build() {
  const repo = {
    findActiveVeterinarians: vi.fn(async () => [
      veterinario('V1', 'Veterinario 1'),
      veterinario('V2', 'Veterinario 2'),
    ]),

    findActiveRooms: vi.fn(async () => [
      consultorio('C1', 'Consultorio 1'),
      consultorio('C2', 'Consultorio 2'),
    ]),

    findActiveWorkSchedules: vi.fn(async () => [
      horario('base-1', 'V1'),
      horario('base-2', 'V2'),
    ]),

    findDailyAvailability: vi.fn(async () => []),

    findSaturdayShift: vi.fn(async () => null),

    findAppointmentsInRange: vi.fn(async () => []),

    findActiveScheduleBlocks: vi.fn(async () => []),
  };

  const service = new ResourcesService(repo as never);

  return { service, repo };
}

describe('ResourcesService - HU-006', () => {
  let ctx: ReturnType<typeof build>;

  beforeEach(() => {
    vi.useFakeTimers();

    vi.setSystemTime(
      new Date('2026-10-30T15:00:00.000Z'),
    );

    ctx = build();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('CP-006-01: muestra V1 y C1 libres y excluye V2 y C2 ocupados', async () => {
    ctx.repo.findAppointmentsInRange.mockResolvedValue([
      cita('V2', 'C2'),
    ] as never);

    const resultado =
      await ctx.service.consultAvailableResources(
        consulta() as never,
      );

    expect(resultado.veterinarios).toEqual([
      {
        id: 'V1',
        nombre: 'Veterinario 1 Prueba',
      },
    ]);

    expect(resultado.consultorios).toEqual([
      {
        id: 'C1',
        nombre: 'Consultorio 1',
      },
    ]);

    expect(resultado.disponible).toBe(true);

    expect(
      resultado.veterinarios.some(
        (vet) => vet.id === 'V2',
      ),
    ).toBe(false);

    expect(
      resultado.consultorios.some(
        (sala) => sala.id === 'C2',
      ),
    ).toBe(false);

    expect(
      ctx.repo.findAppointmentsInRange,
    ).toHaveBeenCalledWith(
      SUCURSAL,
      new Date('2026-11-02T10:00:00.000Z'),
      new Date('2026-11-02T10:30:00.000Z'),
      ['V1', 'V2'],
    );
  });

  it('CP-006-02: excluye al veterinario bloqueado entre 10:30 y 11:00', async () => {
    ctx.repo.findActiveScheduleBlocks.mockResolvedValue([
      {
        id: 'bloqueo-1',
        veterinarioId: 'V1',
        horaInicio: minutesToDbTime(10 * 60 + 30),
        horaFin: minutesToDbTime(11 * 60),
      },
    ] as never);

    const resultado =
      await ctx.service.consultAvailableResources(
        consulta({
          hora: '10:30',
        }) as never,
      );

    expect(
      resultado.veterinarios.some(
        (vet) => vet.id === 'V1',
      ),
    ).toBe(false);

    expect(
      resultado.veterinarios.some(
        (vet) => vet.id === 'V2',
      ),
    ).toBe(true);
  });

  it('CP-006-03: informa que no hay disponibilidad cuando faltan consultorios', async () => {
    ctx.repo.findActiveRooms.mockResolvedValue(
      [] as never,
    );

    const resultado =
      await ctx.service.consultAvailableResources(
        consulta() as never,
      );

    expect(resultado.consultorios).toEqual([]);

    expect(resultado.disponible).toBe(false);

    expect(resultado.mensaje).toBe(
      'Sin disponibilidad en el intervalo seleccionado',
    );
  });

  it('CP-006-04: rechaza una fecha pasada', async () => {
    vi.setSystemTime(
      new Date('2026-11-21T15:00:00.000Z'),
    );

    await expect(
      ctx.service.consultAvailableResources(
        consulta({
          fecha: '2026-11-02',
        }) as never,
      ),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(
      ctx.repo.findActiveVeterinarians,
    ).not.toHaveBeenCalled();
  });

  it('CP-006-05: rechaza una duración de 0 minutos', async () => {
    await expect(
      ctx.service.consultAvailableResources(
        consulta({
          duracionMin: 0,
        }) as never,
      ),
    ).rejects.toThrow(
      'La duración debe ser un múltiplo de 30 minutos',
    );

    expect(
      ctx.repo.findActiveRooms,
    ).not.toHaveBeenCalled();
  });

  it('HU-006: excluye un veterinario ocupado en otra sucursal sin bloquear consultorios de Loja', async () => {

    ctx.repo.findAppointmentsInRange.mockResolvedValue([
      cita('V1', 'C-OTRA', 'suc-otra'),
    ] as never);

    const resultado =
      await ctx.service.consultAvailableResources(
        consulta() as never,
      );

    expect(resultado.veterinarios).toEqual([
      {
        id: 'V2',
        nombre: 'Veterinario 2 Prueba',
      },
    ]);


    expect(resultado.consultorios).toEqual([
      {
        id: 'C1',
        nombre: 'Consultorio 1',
      },
      {
        id: 'C2',
        nombre: 'Consultorio 2',
      },
    ]);

    expect(resultado.disponible).toBe(true);
  });
});
