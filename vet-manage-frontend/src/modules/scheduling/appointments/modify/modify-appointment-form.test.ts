import { describe, expect, it } from 'vitest';
import {
  MODIFY_MESSAGES,
  SLOT_OPTIONS,
  endTime,
  formFromDetail,
  hasChanges,
  scheduleChanged,
  validateModifyForm,
} from './modify-appointment-form';
import type { AppointmentDetail } from './types';

const detail = {
  fecha: '2026-11-02',
  horaInicio: '10:00',
  veterinarioId: 'v-1',
  salaId: 'r-1',
} as AppointmentDetail;

describe('modify-appointment-form', () => {
  it('precarga el formulario con el horario y los recursos actuales', () => {
    expect(formFromDetail(detail)).toEqual({ fecha: '2026-11-02', horaInicio: '10:00', veterinarioId: 'v-1', salaId: 'r-1' });
  });

  it('solo cuenta como cambio de horario la fecha o la hora', () => {
    const form = formFromDetail(detail);
    expect(scheduleChanged(detail, { ...form, salaId: 'r-2', veterinarioId: 'v-2' })).toBe(false);
    expect(scheduleChanged(detail, { ...form, fecha: '2026-11-03' })).toBe(true);
    expect(scheduleChanged(detail, { ...form, horaInicio: '11:00' })).toBe(true);
  });

  it('detecta cuando no hay cambios', () => {
    const form = formFromDetail(detail);
    expect(hasChanges(detail, form)).toBe(false);
    expect(hasChanges(detail, { ...form, salaId: 'r-2' })).toBe(true);
  });

  it('exige fecha, hora, veterinario y consultorio', () => {
    expect(validateModifyForm({ fecha: '', horaInicio: '', veterinarioId: '', salaId: '' })).toEqual({
      fecha: MODIFY_MESSAGES.fecha,
      horaInicio: MODIFY_MESSAGES.horaInicio,
      veterinarioId: MODIFY_MESSAGES.veterinarioId,
      salaId: MODIFY_MESSAGES.salaId,
    });
    expect(validateModifyForm(formFromDetail(detail))).toEqual({});
  });

  it('calcula la hora de fin con la duración de la cita', () => {
    expect(endTime('11:00', 30)).toBe('11:30');
    expect(endTime('09:30', 90)).toBe('11:00');
  });

  it('ofrece horas en períodos de 30 minutos', () => {
    expect(SLOT_OPTIONS).toHaveLength(48);
    expect(SLOT_OPTIONS.slice(0, 3)).toEqual(['00:00', '00:30', '01:00']);
  });
});
