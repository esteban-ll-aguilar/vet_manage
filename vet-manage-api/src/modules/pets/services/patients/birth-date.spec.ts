import { describe, expect, it } from 'vitest';
import { clinicToday, formatBirthDate, parseBirthDate } from './birth-date.js';

// 19-11-2026 a las 15:30 en Ecuador (UTC-5).
const today = new Date('2026-11-19T20:30:00Z');

describe('parseBirthDate', () => {
  it('acepta una fecha válida en formato DD-MM-YYYY', () => {
    expect(parseBirthDate('10-05-2024', today)?.toISOString()).toBe('2024-05-10T00:00:00.000Z');
  });

  it('acepta la fecha de hoy', () => {
    expect(parseBirthDate('19-11-2026', today)).not.toBeNull();
  });

  it.each(['2024-05-10', '10/05/2024', '1-5-2024', '', 'abc'])('rechaza el formato %s', (value) => {
    expect(parseBirthDate(value, today)).toBeNull();
  });

  it.each(['31-02-2024', '30-13-2024', '00-01-2024', '29-02-2023'])('rechaza la fecha inexistente %s', (value) => {
    expect(parseBirthDate(value, today)).toBeNull();
  });

  it('acepta el 29 de febrero de un año bisiesto', () => {
    expect(parseBirthDate('29-02-2024', today)).not.toBeNull();
  });

  it('rechaza una fecha futura', () => {
    expect(parseBirthDate('20-11-2026', today)).toBeNull();
  });

  it('rechaza valores que no son texto', () => {
    expect(parseBirthDate(20241105, today)).toBeNull();
    expect(parseBirthDate(undefined, today)).toBeNull();
  });
});

describe('zona horaria de la clínica', () => {
  // 22:00 del 19-11 en Ecuador, pero ya 20-11 en UTC (hora del contenedor).
  const lateNight = new Date('2026-11-20T03:00:00Z');

  it('usa el día de Ecuador aunque en UTC ya sea el día siguiente', () => {
    expect(clinicToday(lateNight)).toBe(Date.UTC(2026, 10, 19));
  });

  it('rechaza la fecha de mañana en Ecuador', () => {
    expect(parseBirthDate('20-11-2026', lateNight)).toBeNull();
  });

  it('acepta la fecha de hoy en Ecuador', () => {
    expect(parseBirthDate('19-11-2026', lateNight)).not.toBeNull();
  });
});

describe('formatBirthDate', () => {
  it('formatea la fecha como DD-MM-YYYY', () => {
    expect(formatBirthDate(new Date(Date.UTC(2024, 4, 3)))).toBe('03-05-2024');
  });
});
