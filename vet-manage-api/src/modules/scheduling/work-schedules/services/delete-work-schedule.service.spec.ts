import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DeleteWorkScheduleService } from './delete-work-schedule.service.js';
import { minutesToDbTime } from '../../common/time-slots.js';

const existingRecord = () => ({
  id: 'ws-1',
  veterinarioId: 'vet-1',
  sucursalId: 'suc-1',
  diaSemana: 'LUNES',
  horaInicio: minutesToDbTime(480),
  horaFin: minutesToDbTime(720),
  estado: true,
  creadoEn: new Date('2026-01-01T00:00:00Z'),
  actualizadoEn: new Date('2026-01-01T00:00:00Z'),
  veterinario: { person: { firstName: 'Juan', lastName: 'Pérez' } },
  sucursal: { nombre: 'Sucursal Centro' },
});

function build() {
  const repo = {
    findById: vi.fn(async () => existingRecord()),
    countConflictingAppointments: vi.fn(async () => 0),
    countAvailability: vi.fn(async () => 0),
    softDelete: vi.fn(async () => undefined),
  };
  const service = new DeleteWorkScheduleService(repo as never);
  return { service, repo };
}

describe('DeleteWorkScheduleService', () => {
  let ctx: ReturnType<typeof build>;

  beforeEach(() => {
    ctx = build();
  });

  it('lanza NotFoundException cuando el horario no existe', async () => {
    ctx.repo.findById.mockResolvedValue(null as never);

    await expect(ctx.service.remove('missing')).rejects.toThrow(NotFoundException);
  });

  it('elimina (soft delete) un horario sin citas futuras', async () => {
    await ctx.service.remove('ws-1');

    expect(ctx.repo.softDelete).toHaveBeenCalledWith('ws-1');
  });

  it('rechaza eliminación cuando existen citas futuras', async () => {
    ctx.repo.countConflictingAppointments.mockResolvedValue(3);

    await expect(ctx.service.remove('ws-1')).rejects.toThrow(BadRequestException);
    expect(ctx.repo.softDelete).not.toHaveBeenCalled();
  });

  it('rechaza eliminación cuando existen disponibilidades futuras', async () => {
    ctx.repo.countAvailability.mockResolvedValue(1);

    await expect(ctx.service.remove('ws-1')).rejects.toThrow(BadRequestException);
    expect(ctx.repo.softDelete).not.toHaveBeenCalled();
  });

  it('llama countConflictingAppointments con el rango real del horario', async () => {
    await ctx.service.remove('ws-1');

    expect(ctx.repo.countConflictingAppointments).toHaveBeenCalledWith('vet-1', 'LUNES', 480, 720);
  });
});
