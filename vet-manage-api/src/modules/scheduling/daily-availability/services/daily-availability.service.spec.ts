import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { minutesToDbTime } from '../../common/time-slots.js';
import { DailyAvailabilityService } from './daily-availability.service.js';

const base = (overrides: Record<string, unknown> = {}) => ({
  id: 'base-1',
  veterinarioId: 'vet-1',
  sucursalId: 'suc-1',
  diaSemana: 'LUNES',
  horaInicio: minutesToDbTime(8 * 60),
  horaFin: minutesToDbTime(12 * 60),
  estado: true,
  sucursal: { id: 'suc-1', nombre: 'Loja' },
  ...overrides,
});

const slot = (id: string, startMin: number, endMin: number) => ({
  id,
  horarioBaseId: 'base-1',
  fecha: new Date('2026-11-02T00:00:00.000Z'),
  horaInicio: minutesToDbTime(startMin),
  horaFin: minutesToDbTime(endMin),
});

const appointment = (overrides: Record<string, unknown> = {}) => ({
  numero: 12,
  estado: 'CONFIRMADA',
  fechaHora: new Date('2026-11-02T11:00:00.000Z'),
  fechaHoraFin: new Date('2026-11-02T11:30:00.000Z'),
  paciente: { name: 'Firulais' },
  sala: { nombre: 'Consultorio 1', sucursal: { nombre: 'Loja' } },
  ...overrides,
});

function build() {
  const repo = {
    findBasesForDay: vi.fn(async () => [base()]),
    findBaseById: vi.fn(async () => base()),
    findSaturdayShift: vi.fn(async () => null),
    findSlots: vi.fn(async () => []),
    replaceSlots: vi.fn(async () => []),
    clearSlots: vi.fn(async () => ({ count: 0 })),
    findActiveAppointments: vi.fn(async () => []),
  };
  const service = new DailyAvailabilityService(repo as never);
  return { service, repo };
}

describe('DailyAvailabilityService', () => {
  let ctx: ReturnType<typeof build>;

  beforeEach(() => {
    ctx = build();
  });

  it('sin franjas devuelve toda la jornada autorizada', async () => {
    const result = await ctx.service.getMine('vet-1', '2026-11-02');

    expect(result).toEqual({
      fecha: '2026-11-02',
      diaSemana: 'LUNES',
      jornadas: [
        {
          horarioBaseId: 'base-1',
          sucursalId: 'suc-1',
          sucursalNombre: 'Loja',
          horaInicio: '08:00',
          horaFin: '12:00',
          franjas: [],
        },
      ],
    });
  });

  it('devuelve todas las jornadas del día para que se elija una', async () => {
    ctx.repo.findBasesForDay.mockResolvedValue([
      base(),
      base({ id: 'base-2', sucursalId: 'suc-2', sucursal: { id: 'suc-2', nombre: 'Vilcabamba' } }),
    ] as never);

    const result = await ctx.service.getMine('vet-1', '2026-11-02');

    expect(result.jornadas).toHaveLength(2);
    expect(result.jornadas.map((jornada) => jornada.sucursalNombre)).toEqual(['Loja', 'Vilcabamba']);
  });

  it('rechaza una fecha sin horario base', async () => {
    ctx.repo.findBasesForDay.mockResolvedValue([] as never);

    await expect(ctx.service.getMine('vet-1', '2026-11-03')).rejects.toThrow(
      'No existe horario base para la fecha',
    );
  });

  it('rechaza un domingo sin horario base', async () => {
    await expect(ctx.service.getMine('vet-1', '2026-11-01')).rejects.toThrow(
      'No existe horario base para la fecha',
    );
  });

  it('en sábado exige el turno asignado para esa fecha', async () => {
    ctx.repo.findBasesForDay.mockResolvedValue([base({ diaSemana: 'SABADO' })] as never);

    await expect(ctx.service.getMine('vet-1', '2026-11-07')).rejects.toThrow(
      'El veterinario no tiene turno asignado para este sábado',
    );
  });

  it('en sábado usa la jornada del turno asignado', async () => {
    const saturdayBase = base({ id: 'base-sat', diaSemana: 'SABADO' });
    ctx.repo.findBasesForDay.mockResolvedValue([saturdayBase] as never);
    ctx.repo.findSaturdayShift.mockResolvedValue({ horarioBaseId: 'base-sat', horarioBase: saturdayBase } as never);

    const result = await ctx.service.getMine('vet-1', '2026-11-07');

    expect(result.jornadas[0]).toMatchObject({ horarioBaseId: 'base-sat', horaInicio: '08:00' });
  });

  it('guarda una franja válida dentro de la jornada', async () => {
    ctx.repo.replaceSlots.mockResolvedValue([slot('slot-1', 8 * 60, 11 * 60)] as never);

    const result = await ctx.service.saveMine('vet-1', {
      fecha: '2026-11-02',
      horarioBaseId: 'base-1',
      franjas: [{ horaInicio: '08:00', horaFin: '11:00' }],
    });

    expect(result.jornadas[0].franjas).toEqual([
      { id: 'slot-1', horaInicio: '08:00', horaFin: '11:00' },
    ]);
    expect(ctx.repo.replaceSlots).toHaveBeenCalledWith('base-1', expect.any(Date), [
      { startMin: 480, endMin: 660 },
    ]);
  });

  it('acepta varias franjas no solapadas', async () => {
    await ctx.service.saveMine('vet-1', {
      fecha: '2026-11-02',
      horarioBaseId: 'base-1',
      franjas: [
        { horaInicio: '08:00', horaFin: '10:00' },
        { horaInicio: '11:00', horaFin: '12:00' },
      ],
    });

    expect(ctx.repo.replaceSlots).toHaveBeenCalledWith('base-1', expect.any(Date), [
      { startMin: 480, endMin: 600 },
      { startMin: 660, endMin: 720 },
    ]);
  });

  it('rechaza franjas superpuestas', async () => {
    await expect(
      ctx.service.saveMine('vet-1', {
        fecha: '2026-11-02',
        horarioBaseId: 'base-1',
        franjas: [
          { horaInicio: '08:00', horaFin: '10:00' },
          { horaInicio: '09:30', horaFin: '11:00' },
        ],
      }),
    ).rejects.toThrow('Las franjas no pueden superponerse');
  });

  it('rechaza una franja fuera de la jornada autorizada', async () => {
    await expect(
      ctx.service.saveMine('vet-1', {
        fecha: '2026-11-02',
        horarioBaseId: 'base-1',
        franjas: [{ horaInicio: '08:00', horaFin: '13:00' }],
      }),
    ).rejects.toThrow('La disponibilidad diaria debe estar dentro del horario base');
  });

  it('rechaza una hora de fin anterior a la de inicio', async () => {
    await expect(
      ctx.service.saveMine('vet-1', {
        fecha: '2026-11-02',
        horarioBaseId: 'base-1',
        franjas: [{ horaInicio: '12:00', horaFin: '08:00' }],
      }),
    ).rejects.toThrow('La hora de fin debe ser posterior a la hora de inicio');
  });

  it('rechaza modificar la jornada de otro veterinario', async () => {
    ctx.repo.findBaseById.mockResolvedValue(base({ veterinarioId: 'vet-2' }) as never);

    await expect(
      ctx.service.saveMine('vet-1', {
        fecha: '2026-11-02',
        horarioBaseId: 'base-1',
        franjas: [{ horaInicio: '08:00', horaFin: '11:00' }],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza el cambio cuando deja una cita fuera de horario y la informa', async () => {
    ctx.repo.findActiveAppointments.mockResolvedValue([appointment()] as never);

    await expect(
      ctx.service.saveMine('vet-1', {
        fecha: '2026-11-02',
        horarioBaseId: 'base-1',
        franjas: [{ horaInicio: '08:00', horaFin: '11:00' }],
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'El cambio afecta una cita existente',
      errors: ['Cita #12 · 11:00–11:30 · CONFIRMADA · Firulais · Consultorio 1 · Loja'],
    });
    expect(ctx.repo.replaceSlots).not.toHaveBeenCalled();
  });

  it('permite el cambio cuando las citas quedan cubiertas por las franjas', async () => {
    ctx.repo.findActiveAppointments.mockResolvedValue([appointment()] as never);

    await ctx.service.saveMine('vet-1', {
      fecha: '2026-11-02',
      horarioBaseId: 'base-1',
      franjas: [{ horaInicio: '08:00', horaFin: '11:30' }],
    });

    expect(ctx.repo.replaceSlots).toHaveBeenCalledOnce();
  });

  it('rechaza guardar en sábado sin turno asignado', async () => {
    ctx.repo.findBaseById.mockResolvedValue(base({ diaSemana: 'SABADO' }) as never);

    await expect(
      ctx.service.saveMine('vet-1', {
        fecha: '2026-11-07',
        horarioBaseId: 'base-1',
        franjas: [{ horaInicio: '08:00', horaFin: '11:00' }],
      }),
    ).rejects.toThrow('El veterinario no tiene turno asignado para este sábado');
  });

  it('restablece la jornada eliminando las franjas', async () => {
    const result = await ctx.service.resetMine('vet-1', '2026-11-02', 'base-1');

    expect(ctx.repo.clearSlots).toHaveBeenCalledOnce();
    expect(result.jornadas[0].franjas).toEqual([]);
  });

  it('rechaza una fecha con formato inválido', async () => {
    await expect(ctx.service.getMine('vet-1', '2026/11/02')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
