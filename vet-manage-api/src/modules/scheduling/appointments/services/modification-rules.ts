import { ApiException } from '../../../../common/errors/api-exception.js';
import { fromStoredDateTime, localNow, toStoredDateTime } from '../../common/local-time.js';
import { isOnSlot, parseTime } from '../../common/time-slots.js';
import { APPOINTMENT_MESSAGES } from '../appointment-messages.js';

export const MODIFICATION_MESSAGES = {
  invalidStatus: 'El estado de la cita no permite modificaciones',
  scheduleChangeUsed: 'El cliente ya utilizó su único cambio de horario',
  noChanges: 'No hay cambios para guardar',
  invalidDateTime: 'La fecha y hora no son válidas',
  notOnSlot: APPOINTMENT_MESSAGES.notOnSlot,
  nextDay: 'La cita no puede extenderse al día siguiente',
} as const;

// Solo las citas Programadas o Confirmadas admiten cambios.
export const MODIFIABLE_STATUSES = ['PROGRAMADA', 'CONFIRMADA'] as const;

export type CurrentAppointment = {
  estado: string;
  fechaHora: Date;
  fechaHoraFin: Date;
  veterinarioId: string;
  salaId: string;
};

export type ModificationInput = {
  fecha: string;
  horaInicio: string;
  veterinarioId: string;
  salaId: string;
};

export type ModificationPlan = {
  start: Date;
  end: Date;
  // Fecha (00:00 UTC) y minutos locales, para buscar bloqueos de horario.
  date: Date;
  startMinutes: number;
  endMinutes: number;
  scheduleChanged: boolean;
  veterinarianChanged: boolean;
  roomChanged: boolean;
};

// La agenda guarda la hora local como UTC; ver common/local-time.ts.
export const toLocalDateTime = fromStoredDateTime;

function badRequest(message: string, code: string) {
  return new ApiException(message, 400, [], code);
}

export function assertModifiableStatus(estado: string): void {
  if (!(MODIFIABLE_STATUSES as readonly string[]).includes(estado)) {
    throw new ApiException(
      MODIFICATION_MESSAGES.invalidStatus,
      409,
      [],
      'APPOINTMENT_INVALID_STATUS',
    );
  }
}

// Valida el cambio pedido y calcula el nuevo horario conservando la duración de la cita.
export function planModification(
  current: CurrentAppointment,
  input: ModificationInput,
  now = new Date(),
): ModificationPlan {
  assertModifiableStatus(current.estado);

  const date = new Date(`${input.fecha}T00:00:00.000Z`);
  const startMinutes = parseTime(input.horaInicio);
  const dateIsValid =
    /^\d{4}-\d{2}-\d{2}$/.test(input.fecha) &&
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === input.fecha;

  if (!dateIsValid || startMinutes === null) {
    throw badRequest(MODIFICATION_MESSAGES.invalidDateTime, 'APPOINTMENT_INVALID_DATETIME');
  }
  if (!isOnSlot(startMinutes)) {
    throw badRequest(MODIFICATION_MESSAGES.notOnSlot, 'APPOINTMENT_INVALID_SLOT');
  }

  const durationMs = current.fechaHoraFin.getTime() - current.fechaHora.getTime();
  const endMinutes = startMinutes + durationMs / 60_000;
  if (endMinutes >= 1440) {
    throw badRequest(MODIFICATION_MESSAGES.nextDay, 'APPOINTMENT_NEXT_DAY');
  }

  const start = toStoredDateTime(input.fecha, input.horaInicio);
  const end = new Date(start.getTime() + durationMs);

  const scheduleChanged = start.getTime() !== current.fechaHora.getTime();
  const veterinarianChanged = input.veterinarioId !== current.veterinarioId;
  const roomChanged = input.salaId !== current.salaId;

  if (!scheduleChanged && !veterinarianChanged && !roomChanged) {
    throw badRequest(MODIFICATION_MESSAGES.noChanges, 'APPOINTMENT_NO_CHANGES');
  }

  if (start.getTime() <= localNow(now).getTime()) {
    throw badRequest(APPOINTMENT_MESSAGES.mustBeFuture, 'APPOINTMENT_MUST_BE_FUTURE');
  }

  return {
    start,
    end,
    date,
    startMinutes,
    endMinutes,
    scheduleChanged,
    veterinarianChanged,
    roomChanged,
  };
}

// Cambiar la fecha o la hora consume la única oportunidad de cambio del cliente.
export function assertScheduleChangeAvailable(
  plan: Pick<ModificationPlan, 'scheduleChanged'>,
  clientAlreadyChanged: boolean,
): void {
  if (plan.scheduleChanged && clientAlreadyChanged) {
    throw new ApiException(
      MODIFICATION_MESSAGES.scheduleChangeUsed,
      409,
      [],
      'APPOINTMENT_SCHEDULE_CHANGE_USED',
    );
  }
}
