import type { AppointmentDraft } from './types';

export type AppointmentFormValues = Omit<AppointmentDraft, 'duracionMin'> & {
  duracionMin: string;
};

export type AppointmentField = keyof AppointmentFormValues;
export type AppointmentFieldErrors = Partial<Record<AppointmentField, string>>;

export const APPOINTMENT_REQUIRED_FIELDS: AppointmentField[] = [
  'sucursalId',
  'clienteId',
  'pacienteId',
  'servicioId',
  'veterinarioId',
  'salaId',
  'fecha',
  'horaInicio',
  'duracionMin',
];

export const APPOINTMENT_MESSAGES = {
  required: 'Este campo es obligatorio',
  future: 'La fecha y hora deben ser posteriores al momento actual',
  duration:
    'La duración debe ser de al menos 30 minutos y no superar el máximo permitido para el servicio',
} as const;

export function validateAppointmentForm(
  values: AppointmentFormValues,
  maxDuration: number,
  now = new Date(),
): AppointmentFieldErrors {
  const errors: AppointmentFieldErrors = {};

  for (const field of APPOINTMENT_REQUIRED_FIELDS) {
    if (!values[field].trim()) errors[field] = APPOINTMENT_MESSAGES.required;
  }

  if (Object.keys(errors).length > 0) return errors;

  const duration = Number(values.duracionMin);
  if (!Number.isInteger(duration) || duration < 30 || duration % 30 !== 0 || duration > maxDuration) {
    errors.duracionMin = APPOINTMENT_MESSAGES.duration;
  }

  const start = new Date(`${values.fecha}T${values.horaInicio}:00-05:00`);
  if (Number.isNaN(start.getTime()) || start.getTime() <= now.getTime()) {
    errors.fecha = APPOINTMENT_MESSAGES.future;
    errors.horaInicio = APPOINTMENT_MESSAGES.future;
  }

  return errors;
}

export function toAppointmentDraft(values: AppointmentFormValues): AppointmentDraft {
  return { ...values, duracionMin: Number(values.duracionMin) };
}
