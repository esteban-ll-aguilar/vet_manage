import { describe, expect, it, vi } from 'vitest';
import { CalendarService, calendarSlots } from './calendar.service.js';
import { calendarPeriod } from './calendar-period.js';
import type { CalendarRepository } from '../repositories/calendar.repository.js';
import { toStoredDateTime } from '../../common/local-time.js';
import { minutesToDbTime as time } from '../../common/time-slots.js';

type Snapshot = Awaited<ReturnType<CalendarRepository['snapshot']>>;
const fecha = new Date('2026-11-02T00:00:00Z');
const appointment = {
  id: 'c1',
  numero: 101,
  fechaHora: new Date('2026-11-02T10:00:00Z'),
  fechaHoraFin: new Date('2026-11-02T10:30:00Z'),
  estado: 'CONFIRMADA' as const,
  paciente: { name: 'Luna' },
  veterinario: { person: { firstName: 'Ana', lastName: 'Vega' } },
};
function fixture(): Snapshot {
  return {
    branch: { id: 'loja', nombre: 'Loja', estado: true },
    appointments: [appointment],
    schedules: [
      {
        id: 'h1',
        veterinarioId: 'v1',
        sucursalId: 'loja',
        diaSemana: 'LUNES',
        horaInicio: time(480),
        horaFin: time(720),
        estado: true,
        creadoEn: fecha,
        actualizadoEn: fecha,
        disponibilidadesDiarias: [],
      },
    ],
    rooms: [{ id: 'r1' }],
    blocks: [
      { fecha, horaInicio: time(660), horaFin: time(690), veterinarioId: null },
    ],
    shifts: [],
    occupancy: [
      {
        fechaHora: appointment.fechaHora,
        fechaHoraFin: appointment.fechaHoraFin,
        veterinarioId: 'v1',
        salaId: 'r1',
      },
    ],
  };
}
const slot = (data: Snapshot, hora: string, day = '2026-11-02') =>
  calendarSlots(data, [day]).find((s) => s.hora === hora)?.estado;

describe('HU-001 períodos', () => {
  it.each([
    ['2026-11-02', 'dia', '2026-11-02', '2026-11-03', 1],
    ['2026-11-02', 'semana', '2026-11-02', '2026-11-09', 7],
    ['2026-11-09', 'semana', '2026-11-09', '2026-11-16', 7],
    ['2026-11-02', 'mes', '2026-11-01', '2026-12-01', 30],
    ['2027-01-01', 'semana', '2026-12-28', '2027-01-04', 7],
    ['2026-12-31', 'mes', '2026-12-01', '2027-01-01', 31],
    ['2028-02-29', 'mes', '2028-02-01', '2028-03-01', 29],
  ] as const)(
    'CP-001-02 %s %s',
    (fecha, vista, desde, hastaExclusiva, length) => {
      const period = calendarPeriod(fecha, vista);
      expect(period).toMatchObject({ desde, hastaExclusiva });
      expect(period.days).toHaveLength(length);
      expect(period.inicio.toISOString()).toBe(`${desde}T00:00:00.000Z`);
      expect(period.fin.toISOString()).toBe(`${hastaExclusiva}T00:00:00.000Z`);
    },
  );
  it.each(['2026-02-29', '2026-11-31', 'no-fecha', '2026-13-01'])(
    'rechaza fecha imposible %s',
    (date) => expect(() => calendarPeriod(date, 'dia')).toThrow(),
  );
});

describe('HU-001 consulta y disponibilidad', () => {
  it('CP-001-01 lee histórico y detalle del paciente sin consultar HU-006', async () => {
    const data = fixture();
    const repo = {
      snapshot: vi.fn().mockResolvedValue(data),
      detail: vi.fn().mockResolvedValue({
        ...appointment,
        paciente: {
          name: 'Luna',
          client: {
            person: {
              firstName: 'Luis',
              lastName: 'Paz',
              identification: '1100000000',
            },
          },
        },
        sala: { nombre: 'Consultorio 1', sucursal: { nombre: 'Loja' } },
      }),
    };
    const service = new CalendarService(repo as never);
    const result = await service.read({
      sucursalId: 'loja',
      fecha: '2026-11-02',
      vista: 'dia',
    });
    expect(result.citas[0]).toMatchObject({
      numero: 101,
      paciente: 'Luna',
      veterinario: 'Ana Vega',
      estado: 'CONFIRMADA',
      inicio: '2026-11-02T15:00:00.000Z',
      fin: '2026-11-02T15:30:00.000Z',
    });
    expect(await service.detail('c1', 'loja')).toMatchObject({
      cliente: 'Luis Paz',
      cedula: '1100000000',
      consultorio: 'Consultorio 1',
      sucursal: 'Loja',
    });
    expect(repo.detail).toHaveBeenCalledWith('c1', 'loja');
  });
  it.each([
    ['2026-11-02', '00:00', '2026-11-02T05:00:00.000Z'],
    ['2026-11-02', '10:00', '2026-11-02T15:00:00.000Z'],
    ['2026-12-31', '23:00', '2027-01-01T04:00:00.000Z'],
  ])(
    'hora registrada %s %s conserva fecha y franja de Ecuador',
    async (date, hour, instant) => {
      // Mismo constructor que HU-003/HU-004 al persistir una cita.
      const start = toStoredDateTime(date, hour);
      const end = new Date(start.getTime() + 30 * 60000);
      const data = fixture();
      data.schedules[0].diaSemana = date === '2026-12-31' ? 'JUEVES' : 'LUNES';
      data.schedules[0].horaInicio = time(0);
      data.schedules[0].horaFin = time(1439);
      data.blocks = [];
      data.appointments = [
        { ...appointment, fechaHora: start, fechaHoraFin: end },
      ];
      data.occupancy = [
        {
          fechaHora: start,
          fechaHoraFin: end,
          veterinarioId: 'v1',
          salaId: 'r1',
        },
      ];
      const repo = {
        snapshot: vi.fn().mockResolvedValue(data),
        detail: vi.fn().mockResolvedValue({
          ...data.appointments[0],
          paciente: {
            name: 'Luna',
            client: {
              person: {
                firstName: 'Luis',
                lastName: 'Paz',
                identification: '1100000000',
              },
            },
          },
          sala: { nombre: 'Consultorio 1', sucursal: { nombre: 'Loja' } },
        }),
      };
      const service = new CalendarService(repo as never);
      const result = await service.read({
        sucursalId: 'loja',
        fecha: date,
        vista: 'dia',
      });
      expect(repo.snapshot).toHaveBeenCalledWith(
        'loja',
        toStoredDateTime(date, '00:00'),
        new Date(toStoredDateTime(date, '00:00').getTime() + 86400000),
        date,
        calendarPeriod(date, 'dia').hastaExclusiva,
      );
      expect(result.citas[0].inicio).toBe(instant);
      expect((await service.detail('c1', 'loja')).inicio).toBe(instant);
      expect(result.franjas.find((s) => s.hora === hour)).toMatchObject({
        fecha: date,
        inicio: instant,
        estado: 'Ocupado',
      });
      expect(result.franjas.filter((s) => s.estado === 'Ocupado')).toHaveLength(
        1,
      );
    },
  );
  it('CP-001-03 clasifica libre, bloqueo, fuera de atención y ocupado', () => {
    const data = fixture();
    expect(slot(data, '09:00')).toBe('Disponible');
    expect(slot(data, '11:00')).toBe('Bloqueado');
    expect(slot(data, '13:00')).toBe('Fuera de atención');
    expect(slot(data, '10:00')).toBe('Ocupado');
    expect(slot(data, '10:30')).toBe('Disponible');
  });
  it('CP-001-04 filtrar citas no modifica las franjas ni el snapshot', () => {
    const data = fixture();
    const before = structuredClone(data);
    const slots = calendarSlots(data, ['2026-11-02']);
    data.appointments = [];
    expect(calendarSlots(data, ['2026-11-02'])).toEqual(slots);
    data.appointments = before.appointments;
    expect(data).toEqual(before);
  });
  it('cita de otra sucursal ocupa veterinario pero no consultorio local', () => {
    const data = fixture();
    data.occupancy[0].salaId = 'otra-sala';
    expect(slot(data, '10:00')).toBe('Ocupado');
    data.schedules.push({
      ...data.schedules[0],
      id: 'h2',
      veterinarioId: 'v2',
    });
    expect(slot(data, '10:00')).toBe('Disponible');
    data.occupancy[0].salaId = 'r1';
    expect(slot(data, '10:00')).toBe('Ocupado');
  });
  it('bloqueo individual deja disponible otro veterinario; general bloquea todos', () => {
    const data = fixture();
    data.blocks[0].veterinarioId = 'v1';
    expect(slot(data, '11:00')).toBe('Bloqueado');
    data.schedules.push({
      ...data.schedules[0],
      id: 'h2',
      veterinarioId: 'v2',
    });
    expect(slot(data, '11:00')).toBe('Disponible');
    data.blocks[0].veterinarioId = null;
    expect(slot(data, '11:00')).toBe('Bloqueado');
  });
  it('disponibilidad diaria restringe jornada; une intervalos contiguos', () => {
    const data = fixture();
    data.schedules[0].disponibilidadesDiarias = [
      {
        id: 'd1',
        horarioBaseId: 'h1',
        fecha,
        horaInicio: time(540),
        horaFin: time(555),
        creadoEn: fecha,
        actualizadoEn: fecha,
      },
      {
        id: 'd2',
        horarioBaseId: 'h1',
        fecha,
        horaInicio: time(555),
        horaFin: time(570),
        creadoEn: fecha,
        actualizadoEn: fecha,
      },
    ];
    expect(slot(data, '08:00')).toBe('Fuera de atención');
    expect(slot(data, '09:00')).toBe('Disponible');
    data.schedules[0].disponibilidadesDiarias[1].horaInicio = time(556);
    expect(slot(data, '09:00')).toBe('Fuera de atención');
  });
  it('sábado exige turno y domingo no ofrece atención', () => {
    const data = fixture();
    data.schedules[0].diaSemana = 'SABADO';
    expect(slot(data, '09:00', '2026-11-07')).toBe('Fuera de atención');
    data.shifts = [
      { fecha: new Date('2026-11-07T00:00:00Z'), horarioBaseId: 'h1' },
    ];
    expect(slot(data, '09:00', '2026-11-07')).toBe('Disponible');
    data.schedules[0].diaSemana = 'DOMINGO';
    expect(slot(data, '09:00', '2026-11-08')).toBe('Fuera de atención');
  });
  it('vacío, sucursal inactiva y ausencia de consultorios no ofrecen reservas', async () => {
    const data = fixture();
    data.appointments = [];
    data.occupancy = [];
    data.rooms = [];
    expect(slot(data, '09:00')).toBe('Sin recursos');
    data.branch!.estado = false;
    expect(slot(data, '09:00')).toBe('Fuera de atención');
    const service = new CalendarService({
      snapshot: vi.fn().mockResolvedValue(data),
      detail: vi.fn().mockResolvedValue(null),
    } as never);
    expect(
      (
        await service.read({
          sucursalId: 'loja',
          fecha: '2026-11-02',
          vista: 'dia',
        })
      ).citas,
    ).toEqual([]);
    await expect(service.detail('otra', 'loja')).rejects.toMatchObject({
      status: 404,
    });
    data.branch = null;
    await expect(
      service.read({
        sucursalId: 'no-existe',
        fecha: '2026-11-02',
        vista: 'dia',
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('cita que cruza medianoche ocupa la franja local correcta', () => {
    const data = fixture();
    data.schedules[0].horaInicio = time(0);
    data.occupancy = [
      {
        fechaHora: new Date('2026-11-01T23:45:00Z'),
        fechaHoraFin: new Date('2026-11-02T00:15:00Z'),
        veterinarioId: 'v1',
        salaId: 'r1',
      },
    ];
    expect(slot(data, '00:00')).toBe('Ocupado');
    expect(slot(data, '00:30')).toBe('Disponible');
  });
});
