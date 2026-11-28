import { describe, expect, it } from 'vitest';
import type { WorkSchedule } from '../types';
import { describeWorkingHours } from './working-hours';

const schedule = (diaSemana: WorkSchedule['diaSemana'], horaInicio: string, horaFin: string, estado = true) =>
  ({ diaSemana, horaInicio, horaFin, estado }) as WorkSchedule;

const valentina = [
  schedule('LUNES', '09:00', '17:00'),
  schedule('SABADO', '09:00', '13:00'),
  schedule('MARTES', '09:00', '17:00', false),
];

describe('describeWorkingHours', () => {
  it('muestra la jornada del día elegido (30/11/2026 es lunes)', () => {
    expect(describeWorkingHours(valentina, '2026-11-30')).toEqual({
      tone: 'info',
      text: 'Jornada del veterinario el lunes: 09:00–17:00.',
    });
  });

  it('avisa cuando no tiene jornada ese día o la jornada está inactiva', () => {
    expect(describeWorkingHours(valentina, '2026-12-02')?.text).toBe(
      'El veterinario no tiene jornada de atención el miércoles en esta sucursal.',
    );
    expect(describeWorkingHours(valentina, '2026-12-01')?.tone).toBe('warning');
  });

  it('recuerda el turno asignado los sábados y que los domingos no hay atención', () => {
    expect(describeWorkingHours(valentina, '2026-12-05')?.text).toContain('Los sábados solo atiende el veterinario del turno asignado.');
    expect(describeWorkingHours(valentina, '2026-11-29')).toEqual({ tone: 'warning', text: 'Los domingos no hay atención.' });
  });

  it('no muestra nada si la fecha no es válida', () => {
    expect(describeWorkingHours(valentina, '')).toBeNull();
  });
});
