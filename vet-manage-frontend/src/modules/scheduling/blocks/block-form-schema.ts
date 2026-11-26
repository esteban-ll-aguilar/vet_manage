import type { ScheduleBlockDraft, ScheduleBlockScope } from './types';

// Mismos mensajes que devuelve la API en POST /scheduling/schedule-blocks.
export const BLOCK_MESSAGES = {
  sucursalRequired: 'Seleccione la sucursal',
  veterinarioRequired: 'Seleccione el veterinario',
  fechaRequired: 'Ingrese la fecha del bloqueo',
  horaInicioRequired: 'Ingrese la hora de inicio',
  horaInicioSlot: 'La hora de inicio debe ser en punto o y media',
  horaFinRequired: 'Ingrese la hora de fin',
  horaFinSlot: 'La hora de fin debe ser en punto o y media',
  horaFinBeforeInicio: 'La hora de fin debe ser posterior a la hora de inicio',
  motivoRequired: 'Ingrese el motivo del bloqueo',
  motivoTooLong: 'El motivo no puede exceder los 500 caracteres',
} as const;

export const MOTIVO_MAX = 500;

export type BlockFormInput = {
  sucursalId: string;
  alcance: ScheduleBlockScope;
  veterinarioId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  motivo: string;
};

export type BlockField = Exclude<keyof BlockFormInput, 'alcance'>;
export type BlockFieldErrors = Partial<Record<BlockField, string>>;

// Horas de 00:00 a 23:30 cada 30 minutos para los selectores.
export const SLOT_OPTIONS = Array.from({ length: 48 }, (_, index) =>
  `${String(Math.floor(index / 2)).padStart(2, '0')}:${index % 2 === 0 ? '00' : '30'}`);

const toMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

export function validateBlockForm(form: BlockFormInput):
  | { valid: true; value: ScheduleBlockDraft; errors: null }
  | { valid: false; value: null; errors: BlockFieldErrors } {
  const M = BLOCK_MESSAGES;
  const errors: BlockFieldErrors = {};
  const motivo = form.motivo.trim();

  if (!form.sucursalId) errors.sucursalId = M.sucursalRequired;
  if (form.alcance === 'VETERINARIO' && !form.veterinarioId) errors.veterinarioId = M.veterinarioRequired;
  if (!form.fecha) errors.fecha = M.fechaRequired;
  if (!form.horaInicio) errors.horaInicio = M.horaInicioRequired;
  if (!form.horaFin) errors.horaFin = M.horaFinRequired;
  else if (form.horaInicio && toMinutes(form.horaFin) <= toMinutes(form.horaInicio)) errors.horaFin = M.horaFinBeforeInicio;
  if (!motivo) errors.motivo = M.motivoRequired;
  else if (motivo.length > MOTIVO_MAX) errors.motivo = M.motivoTooLong;

  if (Object.keys(errors).length > 0) return { valid: false, value: null, errors };

  return {
    valid: true,
    errors: null,
    value: {
      sucursalId: form.sucursalId,
      alcance: form.alcance,
      ...(form.alcance === 'VETERINARIO' ? { veterinarioId: form.veterinarioId } : {}),
      fecha: form.fecha,
      horaInicio: form.horaInicio,
      horaFin: form.horaFin,
      motivo,
    },
  };
}

const FIELD_BY_MESSAGE: Record<string, BlockField> = {
  [BLOCK_MESSAGES.sucursalRequired]: 'sucursalId',
  [BLOCK_MESSAGES.veterinarioRequired]: 'veterinarioId',
  [BLOCK_MESSAGES.fechaRequired]: 'fecha',
  [BLOCK_MESSAGES.horaInicioRequired]: 'horaInicio',
  [BLOCK_MESSAGES.horaInicioSlot]: 'horaInicio',
  [BLOCK_MESSAGES.horaFinRequired]: 'horaFin',
  [BLOCK_MESSAGES.horaFinSlot]: 'horaFin',
  [BLOCK_MESSAGES.horaFinBeforeInicio]: 'horaFin',
  [BLOCK_MESSAGES.motivoRequired]: 'motivo',
  [BLOCK_MESSAGES.motivoTooLong]: 'motivo',
};

// Ubica junto a su campo los mensajes de validación que devuelve la API.
export function mapApiErrorsToFields(messages: string[]): BlockFieldErrors {
  const errors: BlockFieldErrors = {};
  for (const message of messages) {
    const field = FIELD_BY_MESSAGE[message];
    if (field && !errors[field]) errors[field] = message;
  }
  return errors;
}
