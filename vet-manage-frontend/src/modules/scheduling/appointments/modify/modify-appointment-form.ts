import type { AppointmentChangeDraft, AppointmentDetail } from './types';

export const MODIFY_MESSAGES = {
  fecha: 'Seleccione la fecha',
  horaInicio: 'Seleccione la hora de inicio',
  veterinarioId: 'Seleccione el veterinario',
  salaId: 'Seleccione el consultorio',
  noChanges: 'No hay cambios para guardar',
  invalidStatus: 'El estado de la cita no permite modificaciones',
  scheduleChangeUsed: 'El cliente ya utilizó su único cambio de horario',
  scheduleChangeWarning:
    'Cambiar la fecha o la hora utilizará la única oportunidad de cambio de horario del cliente.',
} as const;

export type ModifyField = keyof AppointmentChangeDraft;
export type ModifyFieldErrors = Partial<Record<ModifyField, string>>;

// Horas de la agenda en períodos de 30 minutos.
export const SLOT_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const minutes = index * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});

export function formFromDetail(detail: AppointmentDetail): AppointmentChangeDraft {
  return {
    fecha: detail.fecha,
    horaInicio: detail.horaInicio,
    veterinarioId: detail.veterinarioId,
    salaId: detail.salaId,
  };
}

export function scheduleChanged(detail: AppointmentDetail, form: AppointmentChangeDraft): boolean {
  return form.fecha !== detail.fecha || form.horaInicio !== detail.horaInicio;
}

export function hasChanges(detail: AppointmentDetail, form: AppointmentChangeDraft): boolean {
  return (
    scheduleChanged(detail, form) ||
    form.veterinarioId !== detail.veterinarioId ||
    form.salaId !== detail.salaId
  );
}

export function validateModifyForm(form: AppointmentChangeDraft): ModifyFieldErrors {
  const errors: ModifyFieldErrors = {};
  for (const field of ['fecha', 'horaInicio', 'veterinarioId', 'salaId'] as const) {
    if (!form[field]) errors[field] = MODIFY_MESSAGES[field];
  }
  return errors;
}

export function endTime(horaInicio: string, duracionMin: number): string {
  const [hours, minutes] = horaInicio.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return '--:--';
  const total = hours * 60 + minutes + duracionMin;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
