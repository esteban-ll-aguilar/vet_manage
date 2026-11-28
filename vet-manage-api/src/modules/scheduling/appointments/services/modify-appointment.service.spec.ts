import { describe, expect, it, vi } from 'vitest';
import { ApiException } from '../../../../common/errors/api-exception.js';
import { APPOINTMENT_MESSAGES } from '../appointment-messages.js';
import { MODIFICATION_MESSAGES } from './modification-rules.js';
import { MODIFY_APPOINTMENT_MESSAGES, ModifyAppointmentService } from './modify-appointment.service.js';

const ID = '33333333-3333-4333-8333-333333333333';
const CLIENT_ID = '44444444-4444-4444-8444-444444444444';
const VET_ID = '55555555-5555-4555-8555-555555555555';
const OTHER_VET_ID = '66666666-6666-4666-8666-666666666666';
const ROOM_1 = '77777777-7777-4777-8777-777777777777';
const ROOM_2 = '88888888-8888-4888-8888-888888888888';
const BRANCH_ID = '99999999-9999-4999-8999-999999999999';
const ACTOR_ID = 'receptionist-1';
const NOW = new Date('2026-11-01T08:00:00-05:00');

function build(estado = 'PROGRAMADA') {
  const db = { tx: true };
  const current = {
    id: ID,
    numero: 12,
    estado,
    fechaHora: new Date('2026-11-02T10:00:00.000Z'),
    fechaHoraFin: new Date('2026-11-02T10:30:00.000Z'),
    veterinarioId: VET_ID,
    salaId: ROOM_1,
    sala: { sucursalId: BRANCH_ID },
    paciente: { clientId: CLIENT_ID },
  };

  const repository = {
    transaction: vi.fn(async (operation: (tx: object) => Promise<unknown>) => operation(db)),
    lock: vi.fn(async () => undefined),
    findForModification: vi.fn(async () => current as typeof current | null),
    clientHasChangedSchedule: vi.fn(async () => false),
    findActiveVeterinarian: vi.fn(async () => ({ id: OTHER_VET_ID }) as { id: string } | null),
    findActiveRoom: vi.fn(async () => ({ id: ROOM_2 }) as { id: string } | null),
    isWithinWorkingHours: vi.fn(async () => true),
    findBlock: vi.fn(async () => null as { id: string } | null),
    findConflicts: vi.fn(async () => [] as { veterinarioId: string; salaId: string }[]),
    update: vi.fn(async (_current: object, _changes: Record<string, unknown>, _db: object) => 1),
    recordScheduleChange: vi.fn(async () => []),
    findUpdated: vi.fn(async (_id: string, _db: object) => ({ ...current })),
  };

  const service = new ModifyAppointmentService(repository as never);
  return { service, repository, current, db };
}

const sameSchedule = { fecha: '2026-11-02', horaInicio: '10:00', veterinarioId: VET_ID, salaId: ROOM_1 };

async function expectRejection(promise: Promise<unknown>, status: number, message: string) {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(ApiException);
  expect((error as ApiException).statusCode).toBe(status);
  expect((error as ApiException).message).toBe(message);
}

describe('ModifyAppointmentService - Cambiar el consultorio de una cita Programada', () => {
  it('reserva el nuevo consultorio conservando fecha, hora y estado', async () => {
    const { service, repository, current, db } = build('PROGRAMADA');
    repository.findUpdated.mockResolvedValue({ ...current, salaId: ROOM_2 });

    const result = await service.execute(ID, { ...sameSchedule, salaId: ROOM_2 }, ACTOR_ID, NOW);

    expect(repository.findActiveRoom).toHaveBeenCalledWith(ROOM_2, BRANCH_ID, db);
    expect(repository.update).toHaveBeenCalledWith(
      current,
      { start: current.fechaHora, end: current.fechaHoraFin, veterinarioId: VET_ID, salaId: ROOM_2 },
      db,
    );
    expect(result).toMatchObject({
      estado: 'PROGRAMADA',
      fecha: '2026-11-02',
      horaInicio: '10:00',
      horaFin: '10:30',
      salaId: ROOM_2,
      cambioHorarioUtilizado: false,
    });
  });

  it('no consume la oportunidad de cambio de horario del cliente', async () => {
    const { service, repository } = build('PROGRAMADA');

    await service.execute(ID, { ...sameSchedule, salaId: ROOM_2 }, ACTOR_ID, NOW);

    expect(repository.clientHasChangedSchedule).not.toHaveBeenCalled();
    expect(repository.recordScheduleChange).not.toHaveBeenCalled();
  });

  it('el consultorio anterior queda libre: el conflicto no cuenta la propia cita', async () => {
    const { service, repository, db } = build('PROGRAMADA');

    await service.execute(ID, { ...sameSchedule, salaId: ROOM_2 }, ACTOR_ID, NOW);

    expect(repository.findConflicts).toHaveBeenCalledWith(ID, expect.objectContaining({ salaId: ROOM_2 }), db);
  });
});

describe('ModifyAppointmentService - Cambiar el horario de una cita Confirmada', () => {
  const newSchedule = { ...sameSchedule, fecha: '2026-11-03', horaInicio: '11:00' };

  it('conserva número y estado, mueve la cita a 11:00–11:30 y conserva su duración', async () => {
    const { service, repository, current } = build('CONFIRMADA');
    repository.findUpdated.mockResolvedValue({
      ...current,
      fechaHora: new Date('2026-11-03T11:00:00.000Z'),
      fechaHoraFin: new Date('2026-11-03T11:30:00.000Z'),
    });

    const result = await service.execute(ID, newSchedule, ACTOR_ID, NOW);

    expect(repository.update.mock.calls[0][1]).toEqual({
      start: new Date('2026-11-03T11:00:00.000Z'),
      end: new Date('2026-11-03T11:30:00.000Z'),
      veterinarioId: VET_ID,
      salaId: ROOM_1,
    });
    expect(result).toMatchObject({
      numero: 12,
      estado: 'CONFIRMADA',
      fecha: '2026-11-03',
      horaInicio: '11:00',
      horaFin: '11:30',
      cambioHorarioUtilizado: true,
    });
  });

  it('registra que el cliente ya utilizó su único cambio y genera el aviso', async () => {
    const { service, repository, current, db } = build('CONFIRMADA');

    await service.execute(ID, newSchedule, ACTOR_ID, NOW);

    expect(repository.recordScheduleChange).toHaveBeenCalledWith(
      current,
      new Date('2026-11-03T11:00:00.000Z'),
      ACTOR_ID,
      NOW,
      db,
    );
  });

  it('no toca los pagos: solo actualiza horario y recursos de la cita', async () => {
    const { service, repository } = build('CONFIRMADA');

    await service.execute(ID, newSchedule, ACTOR_ID, NOW);

    expect(Object.keys(repository.update.mock.calls[0][1]).sort()).toEqual(['end', 'salaId', 'start', 'veterinarioId']);
  });

  it('bloquea al cliente para que dos cambios simultáneos no usen la misma oportunidad', async () => {
    const { service, repository, db } = build('CONFIRMADA');

    await service.execute(ID, newSchedule, ACTOR_ID, NOW);

    expect(repository.lock).toHaveBeenCalledWith(
      expect.arrayContaining([`appointment:client:${CLIENT_ID}`, `appointment:veterinarian:${VET_ID}`]),
      db,
    );
  });
});

describe('ModifyAppointmentService - Intentar cambiar a un horario ocupado', () => {
  it('muestra "Veterinario no disponible" y no modifica ni consume la oportunidad', async () => {
    const { service, repository } = build('PROGRAMADA');
    repository.findConflicts.mockResolvedValue([{ veterinarioId: VET_ID, salaId: ROOM_2 }]);

    await expectRejection(
      service.execute(ID, { ...sameSchedule, fecha: '2026-11-03', horaInicio: '11:00' }, ACTOR_ID, NOW),
      409,
      APPOINTMENT_MESSAGES.veterinarianUnavailable,
    );
    expect(repository.update).not.toHaveBeenCalled();
    expect(repository.recordScheduleChange).not.toHaveBeenCalled();
  });

  it('muestra "Consultorio no disponible" si el nuevo consultorio está ocupado', async () => {
    const { service, repository } = build('PROGRAMADA');
    repository.findConflicts.mockResolvedValue([{ veterinarioId: OTHER_VET_ID, salaId: ROOM_2 }]);

    await expectRejection(
      service.execute(ID, { ...sameSchedule, salaId: ROOM_2 }, ACTOR_ID, NOW),
      409,
      APPOINTMENT_MESSAGES.roomUnavailable,
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('muestra "Horario bloqueado" si el nuevo horario tiene un bloqueo', async () => {
    const { service, repository } = build('PROGRAMADA');
    repository.findBlock.mockResolvedValue({ id: 'block-1' });

    await expectRejection(
      service.execute(ID, { ...sameSchedule, horaInicio: '11:00' }, ACTOR_ID, NOW),
      409,
      APPOINTMENT_MESSAGES.blocked,
    );
    expect(repository.update).not.toHaveBeenCalled();
  });
});

describe('ModifyAppointmentService - jornada del veterinario', () => {
  it('rechaza un horario fuera de su jornada con un mensaje que lo indica', async () => {
    const { service, repository, db } = build('PROGRAMADA');
    repository.isWithinWorkingHours.mockResolvedValue(false);

    await expectRejection(
      service.execute(ID, { ...sameSchedule, horaInicio: '18:00' }, ACTOR_ID, NOW),
      409,
      APPOINTMENT_MESSAGES.outsideWorkingHours,
    );
    expect(repository.isWithinWorkingHours).toHaveBeenCalledWith(
      { sucursalId: BRANCH_ID, veterinarioId: VET_ID, date: new Date('2026-11-02T00:00:00.000Z'), startMinutes: 1080, endMinutes: 1110 },
      db,
    );
    expect(repository.update).not.toHaveBeenCalled();
    expect(repository.recordScheduleChange).not.toHaveBeenCalled();
  });

  it('comprueba la jornada del nuevo veterinario al cambiarlo', async () => {
    const { service, repository, db } = build('PROGRAMADA');

    await service.execute(ID, { ...sameSchedule, veterinarioId: OTHER_VET_ID }, ACTOR_ID, NOW);

    expect(repository.isWithinWorkingHours).toHaveBeenCalledWith(expect.objectContaining({ veterinarioId: OTHER_VET_ID }), db);
  });
});

describe('ModifyAppointmentService - Intentar modificar una cita que ya no admite cambios', () => {
  it.each(['EN_CURSO', 'FINALIZADA', 'CANCELADA', 'NO_ASISTIO'])(
    'una cita %s muestra "El estado de la cita no permite modificaciones"',
    async (estado) => {
      const { service, repository } = build(estado);

      await expectRejection(
        service.execute(ID, { ...sameSchedule, salaId: ROOM_2 }, ACTOR_ID, NOW),
        409,
        MODIFICATION_MESSAGES.invalidStatus,
      );
      expect(repository.update).not.toHaveBeenCalled();
    },
  );
});

describe('ModifyAppointmentService - Intentar cambiar el horario por segunda vez', () => {
  it('muestra "El cliente ya utilizó su único cambio de horario" y conserva la cita', async () => {
    const { service, repository, db } = build('PROGRAMADA');
    repository.clientHasChangedSchedule.mockResolvedValue(true);

    await expectRejection(
      service.execute(ID, { ...sameSchedule, fecha: '2026-11-05' }, ACTOR_ID, NOW),
      409,
      MODIFICATION_MESSAGES.scheduleChangeUsed,
    );
    expect(repository.clientHasChangedSchedule).toHaveBeenCalledWith(CLIENT_ID, db);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('sí permite cambiar solo el veterinario aunque ya haya usado el cambio de horario', async () => {
    const { service, repository } = build('PROGRAMADA');
    repository.clientHasChangedSchedule.mockResolvedValue(true);

    await service.execute(ID, { ...sameSchedule, veterinarioId: OTHER_VET_ID }, ACTOR_ID, NOW);

    expect(repository.update).toHaveBeenCalled();
    expect(repository.recordScheduleChange).not.toHaveBeenCalled();
  });
});

describe('ModifyAppointmentService - otras validaciones', () => {
  it('devuelve 404 "La cita no existe" para un id inválido o una cita inexistente', async () => {
    const { service, repository } = build();
    await expectRejection(service.execute('abc', sameSchedule, ACTOR_ID, NOW), 404, MODIFY_APPOINTMENT_MESSAGES.notFound);

    repository.findForModification.mockResolvedValue(null);
    await expectRejection(service.execute(ID, sameSchedule, ACTOR_ID, NOW), 404, MODIFY_APPOINTMENT_MESSAGES.notFound);
  });

  it('rechaza un veterinario inactivo', async () => {
    const { service, repository } = build();
    repository.findActiveVeterinarian.mockResolvedValue(null);

    await expectRejection(
      service.execute(ID, { ...sameSchedule, veterinarioId: OTHER_VET_ID }, ACTOR_ID, NOW),
      400,
      MODIFY_APPOINTMENT_MESSAGES.inactiveVeterinarian,
    );
  });

  it('rechaza un consultorio de otra sucursal', async () => {
    const { service, repository } = build();
    repository.findActiveRoom.mockResolvedValue(null);

    await expectRejection(
      service.execute(ID, { ...sameSchedule, salaId: ROOM_2 }, ACTOR_ID, NOW),
      400,
      MODIFY_APPOINTMENT_MESSAGES.roomNotInBranch,
    );
  });

  it('responde 409 si otra persona modificó la cita al mismo tiempo', async () => {
    const { service, repository } = build();
    repository.update.mockResolvedValue(0);

    await expectRejection(
      service.execute(ID, { ...sameSchedule, salaId: ROOM_2 }, ACTOR_ID, NOW),
      409,
      MODIFY_APPOINTMENT_MESSAGES.conflict,
    );
    expect(repository.recordScheduleChange).not.toHaveBeenCalled();
  });
});
