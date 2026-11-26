import { describe, expect, it, vi } from 'vitest';
import { ApiException } from '../../../../common/errors/api-exception.js';
import type { ConflictingAppointment, NewScheduleBlock } from '../repositories/schedule-block.repository.js';
import { SCHEDULE_BLOCK_MESSAGES } from './schedule-block-input.js';
import { REGISTER_BLOCK_MESSAGES as M, RegisterScheduleBlockService } from './register-schedule-block.service.js';

const ACTOR_ID = 'admin-1';
const SUCURSAL_ID = '11111111-1111-4111-8111-111111111111';
const VETERINARIO_ID = '22222222-2222-4222-8222-222222222222';

const forVet = {
  sucursalId: SUCURSAL_ID,
  alcance: 'VETERINARIO',
  veterinarioId: VETERINARIO_ID,
  fecha: '2026-11-03',
  horaInicio: '09:00',
  horaFin: '10:00',
  motivo: 'Permiso médico',
};

const forBranch = { ...forVet, alcance: 'SUCURSAL', veterinarioId: undefined, horaInicio: '12:00', horaFin: '13:00', motivo: 'Mantenimiento' };

const appointment: ConflictingAppointment = {
  numero: 12,
  fechaHora: new Date('2026-11-03T09:30:00.000Z'),
  fechaHoraFin: new Date('2026-11-03T10:00:00.000Z'),
  paciente: { name: 'Luna' },
  sala: { nombre: 'Consultorio 1' },
  veterinario: { person: { firstName: 'Valentina', lastName: 'Ruiz' } },
};

function build({ conflicts = [] as ConflictingAppointment[], branch = { id: SUCURSAL_ID, nombre: 'Loja', estado: true } as unknown, vet = { id: VETERINARIO_ID } as unknown } = {}) {
  const tx = { name: 'tx' };
  const repository = {
    findBranch: vi.fn(async () => branch),
    findActiveVeterinarian: vi.fn(async () => vet),
    findConflictingAppointments: vi.fn(async () => conflicts),
    create: vi.fn(async (data: NewScheduleBlock) => ({
      id: 'block-1',
      fecha: data.fecha,
      horaInicio: data.horaInicio,
      horaFin: data.horaFin,
      motivo: data.motivo,
      creadoEn: new Date('2026-11-01T08:00:00.000Z'),
      sucursal: { id: SUCURSAL_ID, nombre: 'Loja' },
      veterinario: data.veterinarioId ? { id: data.veterinarioId, person: { firstName: 'Valentina', lastName: 'Ruiz' } } : null,
      registradoPor: { person: { firstName: 'Marcelo', lastName: 'Paredes' } },
    })),
  };
  const prisma = { $transaction: vi.fn(async (run: (client: unknown) => unknown) => run(tx)) };
  const service = new RegisterScheduleBlockService(repository as never, prisma as never);
  return { service, repository, prisma, tx };
}

async function expectError(promise: Promise<unknown>, message: string, status: number) {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(ApiException);
  expect((error as ApiException).message).toBe(message);
  expect((error as ApiException).statusCode).toBe(status);
  return error as ApiException;
}

describe('RegisterScheduleBlockService', () => {
  it('bloquea el horario de un veterinario y guarda quién lo registró', async () => {
    const { service, repository, tx } = build();

    const block = await service.execute(forVet, ACTOR_ID);

    expect(repository.findConflictingAppointments).toHaveBeenCalledWith({
      sucursalId: SUCURSAL_ID,
      veterinarioId: VETERINARIO_ID,
      inicio: new Date('2026-11-03T09:00:00.000Z'),
      fin: new Date('2026-11-03T10:00:00.000Z'),
    }, tx);
    expect(repository.create).toHaveBeenCalledWith({
      sucursalId: SUCURSAL_ID,
      veterinarioId: VETERINARIO_ID,
      fecha: new Date('2026-11-03T00:00:00.000Z'),
      horaInicio: new Date('1970-01-01T09:00:00.000Z'),
      horaFin: new Date('1970-01-01T10:00:00.000Z'),
      motivo: 'Permiso médico',
      registradoPorId: ACTOR_ID,
    }, tx);
    expect(block).toEqual({
      id: 'block-1',
      sucursal: { id: SUCURSAL_ID, nombre: 'Loja' },
      alcance: 'VETERINARIO',
      veterinario: { id: VETERINARIO_ID, nombre: 'Valentina Ruiz' },
      fecha: '2026-11-03',
      horaInicio: '09:00',
      horaFin: '10:00',
      motivo: 'Permiso médico',
      registradoPor: 'Marcelo Paredes',
      creadoEn: '2026-11-01T08:00:00.000Z',
    });
  });

  it('bloquea toda la sucursal revisando las citas de todos los veterinarios', async () => {
    const { service, repository, tx } = build();

    const block = await service.execute(forBranch, ACTOR_ID);

    expect(repository.findActiveVeterinarian).not.toHaveBeenCalled();
    expect(repository.findConflictingAppointments).toHaveBeenCalledWith({
      sucursalId: SUCURSAL_ID,
      veterinarioId: null,
      inicio: new Date('2026-11-03T12:00:00.000Z'),
      fin: new Date('2026-11-03T13:00:00.000Z'),
    }, tx);
    expect(block.alcance).toBe('SUCURSAL');
    expect(block.veterinario).toBeNull();
  });

  it('rechaza el bloqueo si afecta una cita y muestra sus datos para ubicarla', async () => {
    const { service, repository } = build({ conflicts: [appointment] });

    const error = await expectError(service.execute(forVet, ACTOR_ID), M.appointmentConflict, 409);

    expect(error.code).toBe('SCHEDULE_BLOCK_APPOINTMENT_CONFLICT');
    expect(error.errors).toEqual(['Cita N.° 12 · 03/11/2026 09:30–10:00 · Paciente Luna · Valentina Ruiz · Consultorio 1']);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it.each([
    ['sin motivo', { motivo: '  ' }, SCHEDULE_BLOCK_MESSAGES.motivoRequired],
    ['con la misma hora de inicio y fin', { horaFin: '09:00' }, SCHEDULE_BLOCK_MESSAGES.horaFinBeforeInicio],
  ])('no guarda un bloqueo %s', async (_name, change, message) => {
    const { service, repository } = build();

    const error = await expectError(service.execute({ ...forVet, ...change }, ACTOR_ID), message, 400);

    expect(error.errors).toEqual([message]);
    expect(repository.findBranch).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rechaza una sucursal que no existe o está inactiva', async () => {
    await expectError(build({ branch: null }).service.execute(forVet, ACTOR_ID), M.branchNotFound, 404);
    await expectError(
      build({ branch: { id: SUCURSAL_ID, nombre: 'Loja', estado: false } }).service.execute(forVet, ACTOR_ID),
      M.branchInactive,
      409,
    );
  });

  it('rechaza un veterinario que no existe o no está activo', async () => {
    const { service, repository } = build({ vet: null });

    await expectError(service.execute(forVet, ACTOR_ID), M.veterinarianNotFound, 404);
    expect(repository.create).not.toHaveBeenCalled();
  });
});
