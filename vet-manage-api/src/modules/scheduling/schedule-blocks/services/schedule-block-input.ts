import { isOnSlot, parseTime } from '../../common/time-slots.js';

// Reglas de los datos de un bloqueo. Se validan aquí, y no con decoradores del DTO,
// para devolver un mensaje claro por cada campo.

export type ScheduleBlockScope = 'VETERINARIO' | 'SUCURSAL';

export type ScheduleBlockInput = {
  sucursalId?: unknown;
  alcance?: unknown;
  veterinarioId?: unknown;
  fecha?: unknown;
  horaInicio?: unknown;
  horaFin?: unknown;
  motivo?: unknown;
};

export type ScheduleBlockField = 'sucursalId' | 'alcance' | 'veterinarioId' | 'fecha' | 'horaInicio' | 'horaFin' | 'motivo';

export type ValidScheduleBlock = {
  sucursalId: string;
  // null = bloqueo de toda la sucursal.
  veterinarioId: string | null;
  fecha: Date;
  // Minutos desde la medianoche.
  inicio: number;
  fin: number;
  motivo: string;
};

export type ScheduleBlockValidation =
  | { valid: true; value: ValidScheduleBlock; errors: Record<string, never> }
  | { valid: false; value: null; errors: Partial<Record<ScheduleBlockField, string>> };

export const SCHEDULE_BLOCK_MESSAGES = {
  sucursalRequired: 'Seleccione la sucursal',
  alcanceInvalid: 'Seleccione si el bloqueo es para un veterinario o para toda la sucursal',
  veterinarioRequired: 'Seleccione el veterinario',
  fechaRequired: 'Ingrese la fecha del bloqueo',
  fechaInvalid: 'La fecha del bloqueo no es válida',
  horaInicioRequired: 'Ingrese la hora de inicio',
  horaInicioInvalid: 'La hora de inicio no es válida',
  horaInicioSlot: 'La hora de inicio debe ser en punto o y media',
  horaFinRequired: 'Ingrese la hora de fin',
  horaFinInvalid: 'La hora de fin no es válida',
  horaFinSlot: 'La hora de fin debe ser en punto o y media',
  horaFinBeforeInicio: 'La hora de fin debe ser posterior a la hora de inicio',
  motivoRequired: 'Ingrese el motivo del bloqueo',
  motivoTooLong: 'El motivo no puede exceder los 500 caracteres',
} as const;

export const MOTIVO_MAX = 500;
const SCOPES: readonly ScheduleBlockScope[] = ['VETERINARIO', 'SUCURSAL'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

// Fecha "AAAA-MM-DD" en UTC; rechaza fechas inexistentes como 2026-02-30.
export function parseDate(value: string): Date | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

function validateTime(
  value: string,
  messages: { required: string; invalid: string; slot: string },
): { minutes?: number; error?: string } {
  if (!value) return { error: messages.required };
  const minutes = parseTime(value);
  if (minutes === null) return { error: messages.invalid };
  if (!isOnSlot(minutes)) return { error: messages.slot };
  return { minutes };
}

export function validateScheduleBlockInput(input: ScheduleBlockInput): ScheduleBlockValidation {
  const errors: Partial<Record<ScheduleBlockField, string>> = {};
  const M = SCHEDULE_BLOCK_MESSAGES;

  const sucursalId = text(input.sucursalId);
  if (!UUID_PATTERN.test(sucursalId)) errors.sucursalId = M.sucursalRequired;

  const alcance = text(input.alcance) as ScheduleBlockScope;
  if (!SCOPES.includes(alcance)) errors.alcance = M.alcanceInvalid;

  // El veterinario solo se toma en cuenta si el bloqueo es para un veterinario.
  const veterinarioId = alcance === 'VETERINARIO' ? text(input.veterinarioId) : '';
  if (alcance === 'VETERINARIO' && !UUID_PATTERN.test(veterinarioId)) errors.veterinarioId = M.veterinarioRequired;

  const fechaText = text(input.fecha);
  const fecha = fechaText ? parseDate(fechaText) : null;
  if (!fechaText) errors.fecha = M.fechaRequired;
  else if (!fecha) errors.fecha = M.fechaInvalid;

  const inicio = validateTime(text(input.horaInicio), {
    required: M.horaInicioRequired, invalid: M.horaInicioInvalid, slot: M.horaInicioSlot,
  });
  if (inicio.error) errors.horaInicio = inicio.error;

  const fin = validateTime(text(input.horaFin), {
    required: M.horaFinRequired, invalid: M.horaFinInvalid, slot: M.horaFinSlot,
  });
  if (fin.error) errors.horaFin = fin.error;
  else if (inicio.minutes !== undefined && fin.minutes !== undefined && fin.minutes <= inicio.minutes) {
    errors.horaFin = M.horaFinBeforeInicio;
  }

  const motivo = text(input.motivo);
  if (!motivo) errors.motivo = M.motivoRequired;
  else if (motivo.length > MOTIVO_MAX) errors.motivo = M.motivoTooLong;

  if (Object.keys(errors).length > 0 || !fecha || inicio.minutes === undefined || fin.minutes === undefined) {
    return { valid: false, value: null, errors };
  }

  return {
    valid: true,
    value: {
      sucursalId,
      veterinarioId: alcance === 'VETERINARIO' ? veterinarioId : null,
      fecha,
      inicio: inicio.minutes,
      fin: fin.minutes,
      motivo,
    },
    errors: {},
  };
}
