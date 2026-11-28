import type { AppointmentStatus } from './types';

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  PROGRAMADA: 'Programada',
  CONFIRMADA: 'Confirmada',
  EN_CURSO: 'En curso',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
  NO_ASISTIO: 'No asistió',
};

export function formatAppointmentDate(value: string) {
  return new Intl.DateTimeFormat('es-EC', {
    timeZone: 'UTC',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}
