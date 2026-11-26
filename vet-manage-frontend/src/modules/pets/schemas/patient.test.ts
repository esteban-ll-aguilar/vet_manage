import { describe, expect, it } from 'vitest';
import { emptyPatientForm, isValidBirthDate, maskBirthDate, parseMeasure, PATIENT_FORM_MESSAGES, validatePatientDraft } from './patient';
import type { PatientFormInput } from './patient';

const today = new Date(2026, 10, 19, 15);

const validForm = (overrides: Partial<PatientFormInput> = {}): PatientFormInput => ({
  name: '  Firulais  ',
  speciesId: 'sp-1',
  breedId: 'br-1',
  gender: 'MALE',
  birthDate: '10-05-2024',
  weightKg: '12,5',
  heightCm: '45',
  reproductiveStatus: 'STERILIZED',
  color: '',
  clientId: 'cl-1',
  ...overrides,
});

describe('validatePatientDraft', () => {
  it('devuelve el borrador normalizado y omite el color vacío', () => {
    const result = validatePatientDraft(validForm(), today);

    expect(result.valid).toBe(true);
    expect(result.value).toEqual({
      name: 'Firulais',
      speciesId: 'sp-1',
      breedId: 'br-1',
      gender: 'MALE',
      birthDate: '10-05-2024',
      weightKg: 12.5,
      heightCm: 45,
      reproductiveStatus: 'STERILIZED',
      color: undefined,
      clientId: 'cl-1',
    });
  });

  it('marca todos los obligatorios vacíos con el mensaje general', () => {
    const result = validatePatientDraft(emptyPatientForm, today);

    expect(result.message).toBe(PATIENT_FORM_MESSAGES.missing);
    expect(Object.keys(result.errors ?? {})).toEqual(expect.arrayContaining([
      'name', 'speciesId', 'breedId', 'gender', 'birthDate', 'weightKg', 'heightCm', 'reproductiveStatus', 'clientId',
    ]));
  });

  it('pide el cliente cuando es lo único que falta', () => {
    const result = validatePatientDraft(validForm({ clientId: '' }), today);

    expect(result.message).toBe(PATIENT_FORM_MESSAGES.clientRequired);
    expect(result.errors).toEqual({ clientId: PATIENT_FORM_MESSAGES.clientRequired });
  });

  it('rechaza una fecha inválida', () => {
    const result = validatePatientDraft(validForm({ birthDate: '31-02-2024' }), today);

    expect(result.message).toBe(PATIENT_FORM_MESSAGES.invalidBirthDate);
    expect(result.errors).toEqual({ birthDate: PATIENT_FORM_MESSAGES.invalidBirthDate });
  });

  it.each([
    [{ weightKg: '0' }, ['weightKg']],
    [{ heightCm: '-2' }, ['heightCm']],
    [{ weightKg: 'abc', heightCm: '1.2.3' }, ['weightKg', 'heightCm']],
  ])('rechaza medidas inválidas %j', (override, fields) => {
    const result = validatePatientDraft(validForm(override), today);

    expect(result.message).toBe(PATIENT_FORM_MESSAGES.invalidMeasures);
    expect(Object.keys(result.errors ?? {})).toEqual(fields);
  });
});

describe('isValidBirthDate', () => {
  it.each(['10-05-2024', '19-11-2026', '29-02-2024'])('acepta %s', (value) => {
    expect(isValidBirthDate(value, today)).toBe(true);
  });

  it.each(['2024-05-10', '10/05/2024', '31-02-2024', '29-02-2023', '20-11-2026'])('rechaza %s', (value) => {
    expect(isValidBirthDate(value, today)).toBe(false);
  });
});

describe('parseMeasure', () => {
  it('acepta punto o coma decimal', () => {
    expect(parseMeasure('12.5')).toBe(12.5);
    expect(parseMeasure('12,5')).toBe(12.5);
  });

  it('devuelve NaN para textos no numéricos', () => {
    expect(parseMeasure('abc')).toBeNaN();
    expect(parseMeasure('')).toBeNaN();
  });
});

describe('maskBirthDate', () => {
  it('inserta los guiones y descarta lo que no es dígito', () => {
    expect(maskBirthDate('1005')).toBe('10-05');
    expect(maskBirthDate('10052024')).toBe('10-05-2024');
    expect(maskBirthDate('10/05/2024 extra')).toBe('10-05-2024');
  });
});
