import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UpdateWorkScheduleService } from './update-work-schedule.service.js';
import { minutesToDbTime } from '../../common/time-slots.js';

const existingRecord = () => ({
  id: 'ws-1',
  veterinarioId: 'vet-1',
  sucursalId: 'suc-1',
  diaSemana: 'LUNES',
  horaInicio: minutesToDbTime(480), // 08:00
  horaFin: minutesToDbTime(720),    // 12:00
  estado: true,
  creadoEn: new Date('2026-01-01T00:00:00Z'),
  actualizadoEn: new Date('2026-01-01T00:00:00Z'),
  veterinario: { person: { firstName: 'Juan', lastName: 'Pérez' } },
  sucursal: { nombre: 'Sucursal Centro' },
});

function build() {
  const repo = {
    findById: vi.fn(async () => existingRecord()),
    findOverlapping: vi.fn(async () => []),
    countConflictingAppointments: vi.fn(async () => 0),
    countConflictingAvailability: vi.fn(async () => 0),
    countAvailability: vi.fn(async () => 0),
    update: vi.fn(async () => existingRecord()),
  };
  const service = new UpdateWorkScheduleService(repo as never);
  return { service, repo };
}

describe('UpdateWorkScheduleService', () => {
  let ctx: ReturnType<typeof build>;

  beforeEach(() => {
    ctx = build();
  });

  it('lanza NotFoundException cuando el horario no existe', async () => {
    ctx.repo.findById.mockResolvedValue(null as never);

    await expect(ctx.service.update('missing', { horaInicio: '09:00' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('actualiza un horario válido sin cambiar rango', async () => {
    const updated = { ...existingRecord(), sucursalId: 'suc-2', sucursal: { nombre: 'Otra' } };
    ctx.repo.update.mockResolvedValue(updated as never);

    const result = await ctx.service.update('ws-1', { sucursalId: 'suc-2' });

    expect(result).toMatchObject({ sucursalNombre: 'Otra' });
    expect(ctx.repo.update).toHaveBeenCalledOnce();
  });

  it('rechaza hora de inicio inválida', async () => {
    await expect(ctx.service.update('ws-1', { horaInicio: 'bad' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rechaza cuando hora de fin no es posterior a hora de inicio', async () => {
    await expect(
      ctx.service.update('ws-1', { horaInicio: '14:00', horaFin: '10:00' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza reducción con citas conflictivas', async () => {
    ctx.repo.countConflictingAppointments.mockResolvedValue(2);

    await expect(
      ctx.service.update('ws-1', { horaInicio: '09:00' }), // reducing range from 08:00
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza reducción con disponibilidades conflictivas', async () => {
    ctx.repo.countConflictingAppointments.mockResolvedValue(0);
    ctx.repo.countConflictingAvailability.mockResolvedValue(1);

    await expect(
      ctx.service.update('ws-1', { horaFin: '11:00' }), // reducing range from 12:00
    ).rejects.toThrow(BadRequestException);
  });

  it('permite expansión sin verificar conflictos de reducción', async () => {
    const expanded = {
      ...existingRecord(),
      horaInicio: minutesToDbTime(420),
      horaFin: minutesToDbTime(780),
    };
    ctx.repo.update.mockResolvedValue(expanded as never);

    await ctx.service.update('ws-1', { horaInicio: '07:00', horaFin: '13:00' });

    expect(ctx.repo.countConflictingAppointments).not.toHaveBeenCalled();
    expect(ctx.repo.countConflictingAvailability).not.toHaveBeenCalled();
  });

  it('rechaza horarios superpuestos con otro existente', async () => {
    ctx.repo.findOverlapping.mockResolvedValue([{ id: 'ws-other' }] as never);

    await expect(
      ctx.service.update('ws-1', { horaInicio: '08:00', horaFin: '12:00' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza cambio de sucursal con citas en el horario original', async () => {
    ctx.repo.countConflictingAppointments.mockResolvedValue(1);

    await expect(
      ctx.service.update('ws-1', { sucursalId: 'suc-2' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza cambio de sucursal con disponibilidad futura', async () => {
    ctx.repo.countAvailability.mockResolvedValue(1);

    await expect(
      ctx.service.update('ws-1', { sucursalId: 'suc-2' }),
    ).rejects.toThrow(BadRequestException);
  });
});
