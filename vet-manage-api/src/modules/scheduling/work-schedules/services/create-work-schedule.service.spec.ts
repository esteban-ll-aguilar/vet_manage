import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { CreateWorkScheduleService } from './create-work-schedule.service.js';
import { minutesToDbTime } from '../../common/time-slots.js';

const mockRecord = () => ({
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
    findOverlapping: vi.fn(async () => []),
    create: vi.fn(async () => mockRecord()),
  };
  const service = new CreateWorkScheduleService(repo as never);
  return { service, repo };
}

describe('CreateWorkScheduleService', () => {
  let ctx: ReturnType<typeof build>;

  beforeEach(() => {
    ctx = build();
  });

  it('crea un horario válido y devuelve la respuesta mapeada', async () => {
    const result = await ctx.service.create({
      veterinarioId: 'vet-1',
      sucursalId: 'suc-1',
      diaSemana: 'LUNES',
      horaInicio: '08:00',
      horaFin: '12:00',
    });

    expect(result).toMatchObject({
      id: 'ws-1',
      veterinarioNombre: 'Juan Pérez',
      sucursalNombre: 'Sucursal Centro',
      diaSemana: 'LUNES',
      horaInicio: '08:00',
      horaFin: '12:00',
    });
    expect(ctx.repo.create).toHaveBeenCalledOnce();
  });

  it('rechaza hora de inicio con formato inválido', async () => {
    await expect(
      ctx.service.create({
        veterinarioId: 'vet-1',
        sucursalId: 'suc-1',
        diaSemana: 'LUNES',
        horaInicio: 'abc',
        horaFin: '12:00',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza hora de inicio que no es en punto o y media', async () => {
    await expect(
      ctx.service.create({
        veterinarioId: 'vet-1',
        sucursalId: 'suc-1',
        diaSemana: 'LUNES',
        horaInicio: '08:15',
        horaFin: '12:00',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza hora de fin con formato inválido', async () => {
    await expect(
      ctx.service.create({
        veterinarioId: 'vet-1',
        sucursalId: 'suc-1',
        diaSemana: 'LUNES',
        horaInicio: '08:00',
        horaFin: 'invalid',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza cuando hora de fin no es posterior a hora de inicio', async () => {
    await expect(
      ctx.service.create({
        veterinarioId: 'vet-1',
        sucursalId: 'suc-1',
        diaSemana: 'LUNES',
        horaInicio: '12:00',
        horaFin: '08:00',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza cuando hay horarios superpuestos', async () => {
    ctx.repo.findOverlapping.mockResolvedValue([{ id: 'ws-existing' }] as never);

    await expect(
      ctx.service.create({
        veterinarioId: 'vet-1',
        sucursalId: 'suc-1',
        diaSemana: 'LUNES',
        horaInicio: '08:00',
        horaFin: '12:00',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
