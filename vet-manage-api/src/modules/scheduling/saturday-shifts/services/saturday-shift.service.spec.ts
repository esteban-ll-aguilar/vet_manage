import { describe, expect, it, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { SaturdayShiftService } from './saturday-shift.service.js';

function dbTime(hour: number, minute = 0) {
  return new Date(Date.UTC(1970, 0, 1, hour, minute));
}

function makeRepo(overrides: Record<string, unknown> = {}) {
  return {
    findList: vi.fn(async () => []),
    findById: vi.fn(async () => null),
    findSaturdayBase: vi.fn(async () => ({ id: 'base-1', horaInicio: dbTime(8), horaFin: dbTime(12) })),
    findCrossingAssignments: vi.fn(async () => []),
    findAppointments: vi.fn(async () => []),
    upsert: vi.fn(async (sucursalId: string, fecha: Date, horarioBaseId: string) => ({
      id: `shift-${fecha.toISOString().slice(0, 10)}`,
      sucursalId,
      fecha,
      horarioBaseId,
    })),
    substitute: vi.fn(async (id: string, horarioBaseId: string, justificacion: string) => ({ id, horarioBaseId, justificacion })),
    ...overrides,
  };
}

describe('SaturdayShiftService', () => {
  it('CP-024-01 distribuye V1, V2, V1 con un turno por sábado', async () => {
    const repo = makeRepo();
    const service = new SaturdayShiftService(repo as never);
    const result = await service.generate({
      sucursalId: 'loja',
      fechas: ['2026-11-07', '2026-11-14', '2026-11-21'],
      veterinarioIds: ['V1', 'V2'],
    });
    expect(repo.upsert).toHaveBeenNthCalledWith(1, 'loja', new Date('2026-11-07T00:00:00.000Z'), 'base-1', null);
    expect(repo.upsert).toHaveBeenNthCalledWith(2, 'loja', new Date('2026-11-14T00:00:00.000Z'), 'base-1', null);
    expect(repo.upsert).toHaveBeenNthCalledWith(3, 'loja', new Date('2026-11-21T00:00:00.000Z'), 'base-1', null);
    expect(result).toHaveLength(3);
  });

  it('CP-024-02 sustituye por V3 y guarda la justificación', async () => {
    const repo = makeRepo({
      findById: vi.fn(async () => ({
        id: 'shift-14',
        sucursalId: 'loja',
        fecha: new Date('2026-11-14T00:00:00.000Z'),
        horarioBase: { veterinarioId: 'V2', horaInicio: dbTime(8), horaFin: dbTime(12), veterinario: { person: { firstName: 'V', lastName: '2' } } },
        sucursal: { nombre: 'Loja' },
      })),
    });
    const service = new SaturdayShiftService(repo as never);
    await expect(service.substitute('shift-14', {
      veterinarioId: 'V3',
      justificacion: 'Permiso del veterinario asignado',
    })).resolves.toMatchObject({ justificacion: 'Permiso del veterinario asignado' });
  });

  it('CP-024-03 permite repetir a V1 en el turno del 14/11', async () => {
    const repo = makeRepo({
      findById: vi.fn(async () => ({
        id: 'shift-14',
        sucursalId: 'loja',
        fecha: new Date('2026-11-14T00:00:00.000Z'),
        horarioBase: { veterinarioId: 'V2', horaInicio: dbTime(8), horaFin: dbTime(12), veterinario: { person: { firstName: 'V', lastName: '2' } } },
        sucursal: { nombre: 'Loja' },
      })),
    });
    const service = new SaturdayShiftService(repo as never);
    await expect(service.substitute('shift-14', { veterinarioId: 'V1', justificacion: 'Permiso del veterinario asignado' }))
      .resolves.toMatchObject({ justificacion: 'Permiso del veterinario asignado' });
  });

  it('CP-024-04 rechaza ausencia de horario base', async () => {
    const service = new SaturdayShiftService(makeRepo({ findSaturdayBase: vi.fn(async () => null) }) as never);
    await expect(service.generate({ sucursalId: 'loja', fechas: ['2026-11-28'], veterinarioIds: ['V1'] }))
      .rejects.toThrow('No existe horario base para este sábado');
  });

  it('CP-024-05 rechaza dos veterinarios para la misma sucursal y fecha', async () => {
    const service = new SaturdayShiftService(makeRepo() as never);
    await expect(service.generate({
      sucursalId: 'loja',
      fechas: [],
      veterinarioIds: ['V1', 'V2'],
      asignaciones: [
        { sucursalId: 'loja', fecha: '2026-11-07', veterinarioId: 'V1' },
        { sucursalId: 'loja', fecha: '2026-11-07', veterinarioId: 'V2' },
      ],
    })).rejects.toThrow('Debe existir un único veterinario por sucursal y sábado');
  });

  it('CP-024-06 rechaza intervalos cruzados del mismo veterinario', async () => {
    const repo = makeRepo();
    const service = new SaturdayShiftService(repo as never);
    repo.findSaturdayBase.mockImplementation(async (_veterinarianId: string, sucursalId: string) =>
      sucursalId === 'loja'
        ? { id: 'loja-base', horaInicio: dbTime(8), horaFin: dbTime(12) }
        : { id: 'vilcabamba-base', horaInicio: dbTime(10), horaFin: dbTime(13) });
    await expect(service.generate({
      sucursalId: 'loja',
      fechas: [],
      veterinarioIds: ['V1'],
      asignaciones: [
        { sucursalId: 'loja', fecha: '2026-11-07', veterinarioId: 'V1' },
        { sucursalId: 'vilcabamba', fecha: '2026-11-07', veterinarioId: 'V1' },
      ],
    })).rejects.toThrow('El veterinario ya tiene otro horario asignado en ese mismo intervalo');
  });

  it('CP-024-07 conserva V2 y muestra la cita cuando hay conflicto', async () => {
    const appointments = [{
      numero: 77,
      fechaHora: new Date('2026-11-14T09:00:00.000Z'),
      fechaHoraFin: new Date('2026-11-14T09:30:00.000Z'),
      estado: 'CONFIRMADA',
      paciente: { name: 'Luna', client: { person: { firstName: 'Ana', lastName: 'Lopez' } } },
      sala: { nombre: 'Consultorio 1', sucursal: { nombre: 'Loja' } },
    }];
    const repo = makeRepo({
      findById: vi.fn(async () => ({
        id: 'shift-14',
        sucursalId: 'loja',
        fecha: new Date('2026-11-14T00:00:00.000Z'),
        horarioBase: { veterinarioId: 'V2', horaInicio: dbTime(8), horaFin: dbTime(12), veterinario: { person: { firstName: 'V', lastName: '2' } } },
        sucursal: { nombre: 'Loja' },
      })),
      findAppointments: vi.fn(async () => appointments),
    });
    const service = new SaturdayShiftService(repo as never);
    await expect(service.substitute('shift-14', { veterinarioId: 'V3', justificacion: 'Permiso del veterinario asignado' }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(repo.substitute).not.toHaveBeenCalled();
  });
});
