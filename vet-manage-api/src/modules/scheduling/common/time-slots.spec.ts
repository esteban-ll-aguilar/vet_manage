import {
  dbTimeToMinutes,
  formatTime,
  isOnSlot,
  minutesToDbTime,
  overlaps,
  parseTime,
} from './time-slots.js';

describe('time-slots', () => {
  it('convierte HH:mm a minutos y rechaza valores inválidos', () => {
    expect(parseTime('09:30')).toBe(570);
    expect(parseTime('00:00')).toBe(0);
    expect(parseTime('23:59')).toBe(1439);
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('9:30')).toBeNull();
    expect(parseTime('09:60')).toBeNull();
    expect(parseTime('abc')).toBeNull();
  });

  it('formatea minutos como HH:mm', () => {
    expect(formatTime(570)).toBe('09:30');
    expect(formatTime(0)).toBe('00:00');
  });

  it('acepta solo horas en punto o y media', () => {
    expect(isOnSlot(540)).toBe(true);
    expect(isOnSlot(570)).toBe(true);
    expect(isOnSlot(555)).toBe(false);
  });

  it('convierte entre minutos y columnas Time de Prisma', () => {
    const time = minutesToDbTime(17 * 60 + 30);

    expect(time.toISOString()).toBe('1970-01-01T17:30:00.000Z');
    expect(dbTimeToMinutes(time)).toBe(1050);
  });

  it('detecta cruces y deja pasar intervalos contiguos', () => {
    expect(overlaps(540, 600, 570, 630)).toBe(true);
    expect(overlaps(540, 720, 600, 660)).toBe(true);
    expect(overlaps(540, 600, 600, 660)).toBe(false);
    expect(overlaps(600, 660, 540, 600)).toBe(false);
  });
});
