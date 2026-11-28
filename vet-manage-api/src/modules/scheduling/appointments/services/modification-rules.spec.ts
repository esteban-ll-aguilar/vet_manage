import { describe, expect, it } from 'vitest';
import { ApiException } from '../../../../common/errors/api-exception.js';
import { APPOINTMENT_MESSAGES } from '../appointment-messages.js';
import {
  MODIFICATION_MESSAGES,
  assertScheduleChangeAvailable,
  planModification,
  toLocalDateTime,
} from './modification-rules.js';

const NOW = new Date('2026-11-01T08:00:00-05:00');
const current = {
  estado: 'PROGRAMADA',
  fechaHora: new Date('2026-11-02T10:00:00.000Z'),
  fechaHoraFin: new Date('2026-11-02T11:00:00.000Z'),
  veterinarioId: 'vet-1',
  salaId: 'room-1',
};
const unchanged = { fecha: '2026-11-02', horaInicio: '10:00', veterinarioId: 'vet-1', salaId: 'room-1' };

function messageOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiException);
    return (error as ApiException).message;
  }
  throw new Error('No se lanzó ningún error');
}

describe('planModification', () => {
  it('conserva la duración de la cita al moverla de horario', () => {
    const plan = planModification(current, { ...unchanged, fecha: '2026-11-03', horaInicio: '11:00' }, NOW);

    expect(plan.start).toEqual(new Date('2026-11-03T11:00:00.000Z'));
    expect(plan.end).toEqual(new Date('2026-11-03T12:00:00.000Z'));
    expect(plan).toMatchObject({ startMinutes: 660, endMinutes: 720, scheduleChanged: true });
    expect(plan.date).toEqual(new Date('2026-11-03T00:00:00.000Z'));
  });

  it('distingue el cambio de horario del cambio de veterinario o consultorio', () => {
    const plan = planModification(current, { ...unchanged, veterinarioId: 'vet-2', salaId: 'room-2' }, NOW);

    expect(plan).toMatchObject({ scheduleChanged: false, veterinarianChanged: true, roomChanged: true });
  });

  it('acepta las citas Programadas y Confirmadas', () => {
    expect(() => planModification({ ...current, estado: 'CONFIRMADA' }, { ...unchanged, salaId: 'room-2' }, NOW)).not.toThrow();
  });

  it.each(['EN_CURSO', 'FINALIZADA', 'CANCELADA', 'NO_ASISTIO'])('rechaza una cita %s', (estado) => {
    expect(messageOf(() => planModification({ ...current, estado }, { ...unchanged, salaId: 'room-2' }, NOW)))
      .toBe(MODIFICATION_MESSAGES.invalidStatus);
  });

  it('rechaza una solicitud sin cambios', () => {
    expect(messageOf(() => planModification(current, unchanged, NOW))).toBe(MODIFICATION_MESSAGES.noChanges);
  });

  it('exige que el nuevo horario sea posterior al momento actual', () => {
    expect(messageOf(() => planModification(current, { ...unchanged, fecha: '2026-10-31' }, NOW)))
      .toBe(APPOINTMENT_MESSAGES.mustBeFuture);
  });

  it('exige horas en punto o media hora', () => {
    expect(messageOf(() => planModification(current, { ...unchanged, horaInicio: '10:15' }, NOW)))
      .toBe(MODIFICATION_MESSAGES.notOnSlot);
  });

  it('rechaza fechas inválidas y citas que pasan al día siguiente', () => {
    expect(messageOf(() => planModification(current, { ...unchanged, fecha: '2026-02-30' }, NOW)))
      .toBe(MODIFICATION_MESSAGES.invalidDateTime);
    expect(messageOf(() => planModification(current, { ...unchanged, horaInicio: '23:00' }, NOW)))
      .toBe(MODIFICATION_MESSAGES.nextDay);
  });
});

describe('assertScheduleChangeAvailable', () => {
  it('impide un segundo cambio de horario', () => {
    expect(messageOf(() => assertScheduleChangeAvailable({ scheduleChanged: true }, true)))
      .toBe(MODIFICATION_MESSAGES.scheduleChangeUsed);
  });

  it('permite el primer cambio y los cambios que no tocan el horario', () => {
    expect(() => assertScheduleChangeAvailable({ scheduleChanged: true }, false)).not.toThrow();
    expect(() => assertScheduleChangeAvailable({ scheduleChanged: false }, true)).not.toThrow();
  });
});

describe('toLocalDateTime', () => {
  it('lee la fecha y hora local guardadas como UTC', () => {
    expect(toLocalDateTime(new Date('2026-11-02T23:30:00.000Z'))).toEqual({ fecha: '2026-11-02', hora: '23:30' });
  });
});

describe('planModification - momento actual en hora de Ecuador', () => {
  it('a las 09:30 de Ecuador (14:30 UTC) rechaza mover la cita a las 09:00 del mismo día', () => {
    const now = new Date('2026-11-02T14:30:00.000Z');
    expect(messageOf(() => planModification(current, { ...unchanged, horaInicio: '09:00' }, now)))
      .toBe(APPOINTMENT_MESSAGES.mustBeFuture);
  });

  it('a las 09:30 de Ecuador permite moverla a las 11:00 del mismo día', () => {
    const now = new Date('2026-11-02T14:30:00.000Z');
    expect(() => planModification(current, { ...unchanged, horaInicio: '11:00' }, now)).not.toThrow();
  });
});
