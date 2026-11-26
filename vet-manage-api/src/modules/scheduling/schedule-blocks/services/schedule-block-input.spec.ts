import { describe, expect, it } from 'vitest';
import { SCHEDULE_BLOCK_MESSAGES as M, validateScheduleBlockInput } from './schedule-block-input.js';

const SUCURSAL_ID = '11111111-1111-4111-8111-111111111111';
const VETERINARIO_ID = '22222222-2222-4222-8222-222222222222';

const forVet = {
  sucursalId: SUCURSAL_ID,
  alcance: 'VETERINARIO',
  veterinarioId: VETERINARIO_ID,
  fecha: '2026-11-03',
  horaInicio: '09:00',
  horaFin: '10:00',
  motivo: 'Permiso médico',
};

describe('validateScheduleBlockInput', () => {
  it('acepta un bloqueo para un veterinario y normaliza los datos', () => {
    const result = validateScheduleBlockInput({ ...forVet, motivo: '  Permiso médico  ' });

    expect(result.valid).toBe(true);
    expect(result.value).toEqual({
      sucursalId: SUCURSAL_ID,
      veterinarioId: VETERINARIO_ID,
      fecha: new Date(Date.UTC(2026, 10, 3)),
      inicio: 540,
      fin: 600,
      motivo: 'Permiso médico',
    });
  });

  it('acepta un bloqueo de toda la sucursal e ignora el veterinario enviado', () => {
    const result = validateScheduleBlockInput({
      ...forVet, alcance: 'SUCURSAL', horaInicio: '12:00', horaFin: '13:00', motivo: 'Mantenimiento',
    });

    expect(result.valid).toBe(true);
    expect(result.value?.veterinarioId).toBeNull();
  });

  it('exige el motivo del bloqueo', () => {
    for (const motivo of [undefined, '', '   ']) {
      expect(validateScheduleBlockInput({ ...forVet, motivo }).errors).toEqual({ motivo: M.motivoRequired });
    }
    expect(validateScheduleBlockInput({ ...forVet, motivo: 'x'.repeat(501) }).errors).toEqual({ motivo: M.motivoTooLong });
  });

  it('exige que la hora de fin sea posterior a la de inicio', () => {
    expect(validateScheduleBlockInput({ ...forVet, horaFin: '09:00' }).errors).toEqual({ horaFin: M.horaFinBeforeInicio });
    expect(validateScheduleBlockInput({ ...forVet, horaFin: '08:30' }).errors).toEqual({ horaFin: M.horaFinBeforeInicio });
  });

  it('exige horas en punto o y media', () => {
    expect(validateScheduleBlockInput({ ...forVet, horaInicio: '09:15' }).errors).toEqual({ horaInicio: M.horaInicioSlot });
    expect(validateScheduleBlockInput({ ...forVet, horaFin: '10:45' }).errors).toEqual({ horaFin: M.horaFinSlot });
  });

  it('rechaza horas vacías o con formato incorrecto', () => {
    expect(validateScheduleBlockInput({ ...forVet, horaInicio: '' }).errors).toEqual({ horaInicio: M.horaInicioRequired });
    expect(validateScheduleBlockInput({ ...forVet, horaFin: undefined }).errors).toEqual({ horaFin: M.horaFinRequired });
    expect(validateScheduleBlockInput({ ...forVet, horaInicio: '9:00' }).errors).toEqual({ horaInicio: M.horaInicioInvalid });
    expect(validateScheduleBlockInput({ ...forVet, horaFin: '25:00' }).errors).toEqual({ horaFin: M.horaFinInvalid });
  });

  it('exige una fecha válida', () => {
    expect(validateScheduleBlockInput({ ...forVet, fecha: '' }).errors).toEqual({ fecha: M.fechaRequired });
    expect(validateScheduleBlockInput({ ...forVet, fecha: '2026-02-30' }).errors).toEqual({ fecha: M.fechaInvalid });
    expect(validateScheduleBlockInput({ ...forVet, fecha: '03/11/2026' }).errors).toEqual({ fecha: M.fechaInvalid });
  });

  it('exige la sucursal, el alcance y, para un veterinario, el veterinario', () => {
    expect(validateScheduleBlockInput({ ...forVet, sucursalId: 'no-es-uuid' }).errors).toEqual({ sucursalId: M.sucursalRequired });
    expect(validateScheduleBlockInput({ ...forVet, alcance: 'OTRO' }).errors).toEqual({ alcance: M.alcanceInvalid });
    expect(validateScheduleBlockInput({ ...forVet, veterinarioId: '' }).errors).toEqual({ veterinarioId: M.veterinarioRequired });
  });

  it('devuelve todos los errores a la vez', () => {
    const result = validateScheduleBlockInput({});

    expect(result.valid).toBe(false);
    expect(Object.keys(result.errors).sort()).toEqual(['alcance', 'fecha', 'horaFin', 'horaInicio', 'motivo', 'sucursalId']);
  });
});
