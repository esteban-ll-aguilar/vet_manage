import type { DiaSemana, WorkSchedule } from '../types';

const WEEKDAYS: (DiaSemana | 'DOMINGO')[] = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

const DAY_LABELS: Record<DiaSemana | 'DOMINGO', string> = {
  DOMINGO: 'domingo',
  LUNES: 'lunes',
  MARTES: 'martes',
  MIERCOLES: 'miércoles',
  JUEVES: 'jueves',
  VIERNES: 'viernes',
  SABADO: 'sábado',
};

export type WorkingHoursSummary = {
  tone: 'info' | 'warning';
  text: string;
};

// Describe la jornada del veterinario en la sucursal para el día de la fecha elegida.
export function describeWorkingHours(schedules: WorkSchedule[], fecha: string): WorkingHoursSummary | null {
  const date = new Date(`${fecha}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(date.getTime())) return null;

  const weekday = WEEKDAYS[date.getUTCDay()];
  const day = DAY_LABELS[weekday];
  if (weekday === 'DOMINGO') {
    return { tone: 'warning', text: 'Los domingos no hay atención.' };
  }

  const ranges = schedules
    .filter((schedule) => schedule.estado && schedule.diaSemana === weekday)
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
    .map((schedule) => `${schedule.horaInicio}–${schedule.horaFin}`);

  if (ranges.length === 0) {
    return { tone: 'warning', text: `El veterinario no tiene jornada de atención el ${day} en esta sucursal.` };
  }

  const saturday = weekday === 'SABADO' ? ' Los sábados solo atiende el veterinario del turno asignado.' : '';
  return { tone: 'info', text: `Jornada del veterinario el ${day}: ${ranges.join(', ')}.${saturday}` };
}
