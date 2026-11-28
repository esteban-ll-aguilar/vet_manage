import { describe, expect, it, vi } from 'vitest';
import { coversInterval, isWithinWorkingHours } from './working-hours.js';

const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);

function db(options: {
  schedules?: { id: string; horaInicio: Date; horaFin: Date }[];
  shift?: { horarioBaseId: string } | null;
  ranges?: { horaInicio: Date; horaFin: Date }[];
} = {}) {
  return {
    horarioBase: { findMany: vi.fn(async () => options.schedules ?? [{ id: 'h-1', horaInicio: time('08:00'), horaFin: time('12:00') }]) },
    turnoSabado: { findUnique: vi.fn(async () => options.shift ?? null) },
    disponibilidadDiaria: { findMany: vi.fn(async () => options.ranges ?? []) },
  };
}

// 02/11/2026 es lunes y 07/11/2026 es sábado.
const monday = { veterinarioId: 'vet-1', sucursalId: 'loja', date: new Date('2026-11-02T00:00:00.000Z') };
const saturday = { ...monday, date: new Date('2026-11-07T00:00:00.000Z') };
const at = (start: number, end: number) => ({ startMinutes: start, endMinutes: end });

describe('isWithinWorkingHours', () => {
  it('acepta un horario dentro de la jornada (08:00–12:00) y consulta la jornada de ese día', async () => {
    const fake = db();

    await expect(isWithinWorkingHours(fake as never, { ...monday, ...at(540, 570) })).resolves.toBe(true);
    expect(fake.horarioBase.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { veterinarioId: 'vet-1', sucursalId: 'loja', diaSemana: 'LUNES', estado: true },
    }));
  });

  it('rechaza un horario fuera de atención o que sobrepasa la jornada', async () => {
    await expect(isWithinWorkingHours(db() as never, { ...monday, ...at(780, 810) })).resolves.toBe(false);
    await expect(isWithinWorkingHours(db() as never, { ...monday, ...at(690, 750) })).resolves.toBe(false);
  });

  it('rechaza si el veterinario no tiene jornada ese día o es domingo', async () => {
    await expect(isWithinWorkingHours(db({ schedules: [] }) as never, { ...monday, ...at(540, 570) })).resolves.toBe(false);
    const sunday = { ...monday, date: new Date('2026-11-01T00:00:00.000Z') };
    await expect(isWithinWorkingHours(db() as never, { ...sunday, ...at(540, 570) })).resolves.toBe(false);
  });

  it('el sábado solo atiende el veterinario del turno asignado', async () => {
    await expect(isWithinWorkingHours(db({ shift: { horarioBaseId: 'h-1' } }) as never, { ...saturday, ...at(540, 570) })).resolves.toBe(true);
    await expect(isWithinWorkingHours(db({ shift: { horarioBaseId: 'otro' } }) as never, { ...saturday, ...at(540, 570) })).resolves.toBe(false);
    await expect(isWithinWorkingHours(db({ shift: null }) as never, { ...saturday, ...at(540, 570) })).resolves.toBe(false);
  });

  it('respeta la disponibilidad diaria que registró el veterinario', async () => {
    const ranges = [{ horaInicio: time('08:00'), horaFin: time('09:00') }, { horaInicio: time('09:00'), horaFin: time('10:00') }];

    await expect(isWithinWorkingHours(db({ ranges }) as never, { ...monday, ...at(510, 570) })).resolves.toBe(true);
    await expect(isWithinWorkingHours(db({ ranges }) as never, { ...monday, ...at(600, 630) })).resolves.toBe(false);
  });
});

describe('coversInterval', () => {
  it('une franjas contiguas y detecta huecos', () => {
    expect(coversInterval([{ inicio: 540, fin: 570 }, { inicio: 480, fin: 540 }], 480, 570)).toBe(true);
    expect(coversInterval([{ inicio: 480, fin: 510 }, { inicio: 540, fin: 570 }], 480, 570)).toBe(false);
  });
});
