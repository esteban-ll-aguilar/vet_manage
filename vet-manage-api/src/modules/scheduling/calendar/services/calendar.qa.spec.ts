import { describe, it, expect, vi } from 'vitest';
import { validate } from 'class-validator';
import { CalendarService, calendarSlots } from './calendar.service.js';
import { calendarPeriod } from './calendar-period.js';
import { CalendarQueryDto } from '../dtos/calendar-query.dto.js';
import type { CalendarRepository } from '../repositories/calendar.repository.js';
import { minutesToDbTime } from '../../common/time-slots.js';

type Snapshot = Awaited<ReturnType<CalendarRepository['snapshot']>>;
function fixture(): Snapshot {
  const fecha = new Date('2026-11-02T00:00:00Z');
  return {
    branch: { id: 'loja', nombre: 'Loja', estado: true },
    appointments: [],
    schedules: [
      {
        id: 'h1',
        veterinarioId: 'v1',
        sucursalId: 'loja',
        diaSemana: 'LUNES',
        horaInicio: minutesToDbTime(480),
        horaFin: minutesToDbTime(720),
        estado: true,
        creadoEn: fecha,
        actualizadoEn: fecha,
        disponibilidadesDiarias: [],
      },
    ],
    rooms: [{ id: 'r1' }],
    blocks: [],
    shifts: [],
    occupancy: [],
  };
}
const state = (data: Snapshot, hora: string) =>
  calendarSlots(data, ['2026-11-02']).find((s) => s.hora === hora)?.estado;
const query = {
  sucursalId: 'loja',
  fecha: '2026-11-02',
  vista: 'dia' as const,
};

describe('QA adicional HU-001', () => {
  it('CP-001-14 inicio de jornada incluido', () =>
    expect(state(fixture(), '08:00')).toBe('Disponible'));
  it('CP-001-15 fin de jornada excluido', () =>
    expect(state(fixture(), '12:00')).toBe('Fuera de atención'));
  it('CP-001-16 una cita de una hora ocupa ambas medias horas', () => {
    const d = fixture();
    d.occupancy = [
      {
        fechaHora: new Date('2026-11-02T10:00:00Z'),
        fechaHoraFin: new Date('2026-11-02T11:00:00Z'),
        veterinarioId: 'v1',
        salaId: 'r1',
      },
    ];
    expect(state(d, '09:30')).toBe('Disponible');
    expect(state(d, '10:00')).toBe('Ocupado');
    expect(state(d, '10:30')).toBe('Ocupado');
    expect(state(d, '11:00')).toBe('Disponible');
  });
  it('CP-001-17 bloqueo respeta limites sin invadir franja adyacente', () => {
    const d = fixture();
    d.blocks = [
      {
        fecha: new Date('2026-11-02T00:00:00Z'),
        horaInicio: minutesToDbTime(540),
        horaFin: minutesToDbTime(570),
        veterinarioId: null,
      },
    ];
    expect(state(d, '08:30')).toBe('Disponible');
    expect(state(d, '09:00')).toBe('Bloqueado');
    expect(state(d, '09:30')).toBe('Disponible');
  });
  it('CP-001-18 sin jornada no ofrece reserva', () => {
    const d = fixture();
    d.schedules = [];
    expect(state(d, '09:00')).toBe('Fuera de atención');
  });
  it('CP-001-19 consultorio inexistente impide reserva', () => {
    const d = fixture();
    d.rooms = [];
    expect(state(d, '09:00')).toBe('Sin recursos');
  });
  it('CP-001-20 sucursal inactiva impide reserva', () => {
    const d = fixture();
    d.branch!.estado = false;
    expect(state(d, '09:00')).toBe('Fuera de atención');
  });
  it('CP-001-21 sucursal inexistente responde 404', async () => {
    const d = fixture();
    d.branch = null;
    const service = new CalendarService({
      snapshot: vi.fn().mockResolvedValue(d),
    } as never);
    await expect(service.read(query)).rejects.toMatchObject({ status: 404 });
  });
  it('CP-001-22 cita inexistente responde 404', async () => {
    const service = new CalendarService({
      detail: vi.fn().mockResolvedValue(null),
    } as never);
    await expect(service.detail('ausente', 'loja')).rejects.toMatchObject({
      status: 404,
    });
  });
  it('CP-001-23 fecha imposible rechazada', () =>
    expect(() => calendarPeriod('2026-02-29', 'dia')).toThrow());
  it('CP-001-24 fecha en formato incorrecto rechazada', async () => {
    const errors = await validate(
      Object.assign(new CalendarQueryDto(), {
        sucursalId: '11111111-1111-4111-8111-111111111111',
        fecha: '02/11/2026',
        vista: 'dia',
      }),
    );
    expect(errors.map((e) => e.property)).toEqual(['fecha']);
  });
  it('CP-001-25 vista no admitida rechazada', () =>
    expect(() => calendarPeriod('2026-11-02', 'anual' as never)).toThrow());
  it('CP-001-26 sucursal con identificador invalido rechazada', async () => {
    const errors = await validate(
      Object.assign(new CalendarQueryDto(), {
        ...query,
        sucursalId: 'no-uuid',
      }),
    );
    expect(errors.map((e) => e.property)).toEqual(['sucursalId']);
  });
  it('CP-001-27 parametros ausentes rechazados', async () =>
    expect(
      (await validate(new CalendarQueryDto())).map((e) => e.property).sort(),
    ).toEqual(['fecha', 'sucursalId', 'vista']));
  it('CP-001-28 periodo semanal cruza año correctamente', () =>
    expect(calendarPeriod('2027-01-01', 'semana')).toMatchObject({
      desde: '2026-12-28',
      hastaExclusiva: '2027-01-04',
    }));
  it('CP-001-29 febrero bisiesto incluye 29 dias', () =>
    expect(calendarPeriod('2028-02-29', 'mes').days).toHaveLength(29));
  it.each([
    ['dia', 48],
    ['semana', 336],
    ['mes', 1440],
  ] as const)(
    'CP-001-30 cuadrícula %s completa en intervalos de treinta minutos',
    (view, count) => {
      const slots = calendarSlots(
        fixture(),
        calendarPeriod('2026-11-02', view).days,
      );
      expect(slots).toHaveLength(count);
      for (const s of slots)
        expect(Date.parse(s.fin) - Date.parse(s.inicio)).toBe(1800000);
      expect(new Set(slots.map((s) => s.inicio)).size).toBe(count);
    },
  );
  it('CP-001-31 eliminar bloqueo del snapshot libera la franja (simulacion)', () => {
    const d = fixture();
    d.blocks = [
      {
        fecha: new Date('2026-11-02T00:00:00Z'),
        horaInicio: minutesToDbTime(540),
        horaFin: minutesToDbTime(570),
        veterinarioId: null,
      },
    ];
    expect(state(d, '09:00')).toBe('Bloqueado');
    d.blocks = [];
    expect(state(d, '09:00')).toBe('Disponible');
  });
});
