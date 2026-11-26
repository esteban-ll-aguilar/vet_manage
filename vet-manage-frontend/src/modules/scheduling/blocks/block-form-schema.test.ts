import { describe, expect, it } from 'vitest';
import { BLOCK_MESSAGES as M, SLOT_OPTIONS, mapApiErrorsToFields, validateBlockForm, type BlockFormInput } from './block-form-schema';

const valid: BlockFormInput = {
  sucursalId: 's-1', alcance: 'VETERINARIO', veterinarioId: 'v-1',
  fecha: '2026-11-03', horaInicio: '09:00', horaFin: '10:00', motivo: '  Permiso médico ',
};

describe('validateBlockForm', () => {
  it('arma el bloqueo de un veterinario con el motivo sin espacios', () => {
    expect(validateBlockForm(valid).value).toEqual({
      sucursalId: 's-1', alcance: 'VETERINARIO', veterinarioId: 'v-1',
      fecha: '2026-11-03', horaInicio: '09:00', horaFin: '10:00', motivo: 'Permiso médico',
    });
  });

  it('en un bloqueo de toda la sucursal no envía veterinario', () => {
    const result = validateBlockForm({ ...valid, alcance: 'SUCURSAL', veterinarioId: '' });

    expect(result.valid).toBe(true);
    expect(result.value).not.toHaveProperty('veterinarioId');
  });

  it('muestra los mensajes de la historia para motivo vacío y misma hora', () => {
    expect(validateBlockForm({ ...valid, motivo: '   ' }).errors).toEqual({ motivo: M.motivoRequired });
    expect(validateBlockForm({ ...valid, horaFin: '09:00' }).errors).toEqual({ horaFin: M.horaFinBeforeInicio });
  });

  it('exige veterinario solo cuando el bloqueo es para un veterinario', () => {
    expect(validateBlockForm({ ...valid, veterinarioId: '' }).errors).toEqual({ veterinarioId: M.veterinarioRequired });
  });

  it('marca todos los campos vacíos', () => {
    const result = validateBlockForm({ ...valid, sucursalId: '', fecha: '', horaInicio: '', horaFin: '', motivo: '' });

    expect(result.errors).toEqual({
      sucursalId: M.sucursalRequired, fecha: M.fechaRequired, horaInicio: M.horaInicioRequired,
      horaFin: M.horaFinRequired, motivo: M.motivoRequired,
    });
  });
});

describe('mapApiErrorsToFields', () => {
  it('ubica los mensajes conocidos y deja fuera los demás', () => {
    expect(mapApiErrorsToFields([M.horaFinSlot, 'Cita N.° 12 · 03/11/2026 09:30–10:00'])).toEqual({ horaFin: M.horaFinSlot });
  });
});

it('ofrece horas cada 30 minutos de 00:00 a 23:30', () => {
  expect(SLOT_OPTIONS).toHaveLength(48);
  expect(SLOT_OPTIONS.slice(0, 3)).toEqual(['00:00', '00:30', '01:00']);
  expect(SLOT_OPTIONS.at(-1)).toBe('23:30');
});
