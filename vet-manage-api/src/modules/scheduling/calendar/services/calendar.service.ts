import { Injectable, NotFoundException } from '@nestjs/common';
import {
  dbTimeToMinutes,
  formatTime,
  overlaps,
} from '../../common/time-slots.js';
import {
  storedDateTimeToInstant,
  toStoredDateTime,
} from '../../common/local-time.js';
import { CalendarRepository } from '../repositories/calendar.repository.js';
import type { CalendarQueryDto } from '../dtos/calendar-query.dto.js';
import { calendarPeriod } from './calendar-period.js';

type Snapshot = Awaited<ReturnType<CalendarRepository['snapshot']>>;
const weekdays = [
  'DOMINGO',
  'LUNES',
  'MARTES',
  'MIERCOLES',
  'JUEVES',
  'VIERNES',
  'SABADO',
];
const dateKey = (date: Date) => date.toISOString().slice(0, 10);
const name = (person: { firstName: string; lastName: string }) =>
  `${person.firstName} ${person.lastName}`;
function summary(cita: Snapshot['appointments'][number]) {
  return {
    id: cita.id,
    numero: cita.numero,
    inicio: storedDateTimeToInstant(cita.fechaHora).toISOString(),
    fin: storedDateTimeToInstant(cita.fechaHoraFin).toISOString(),
    estado: cita.estado,
    paciente: cita.paciente.name,
    veterinario: name(cita.veterinario.person),
  };
}

export function calendarSlots(data: Snapshot, days: string[]) {
  return days.flatMap((fecha) => {
    const weekday = weekdays[new Date(`${fecha}T00:00:00Z`).getUTCDay()];
    const schedules = data.schedules.filter(
      (s) =>
        data.branch?.estado &&
        weekday !== 'DOMINGO' &&
        s.diaSemana === weekday &&
        (weekday !== 'SABADO' ||
          data.shifts.some(
            (t) => dateKey(t.fecha) === fecha && t.horarioBaseId === s.id,
          )),
    );
    const blocks = data.blocks.filter((b) => dateKey(b.fecha) === fecha);
    return Array.from({ length: 48 }, (_, index) => {
      const minute = index * 30;
      // Comparar en la representación de persistencia; convertir a instante solo al responder.
      const inicio = toStoredDateTime(fecha, formatTime(minute));
      const fin = new Date(inicio.getTime() + 1800000);
      const candidates = schedules.filter((s) => {
        if (
          dbTimeToMinutes(s.horaInicio) > minute ||
          dbTimeToMinutes(s.horaFin) < minute + 30
        )
          return false;
        const daily = s.disponibilidadesDiarias
          .filter((d) => dateKey(d.fecha) === fecha)
          .sort(
            (a, b) =>
              dbTimeToMinutes(a.horaInicio) - dbTimeToMinutes(b.horaInicio),
          );
        if (!daily.length) return true;
        let covered = minute;
        for (const d of daily) {
          if (dbTimeToMinutes(d.horaInicio) > covered) break;
          covered = Math.max(covered, dbTimeToMinutes(d.horaFin));
        }
        return covered >= minute + 30;
      });
      const blocking = blocks.filter((b) =>
        overlaps(
          minute,
          minute + 30,
          dbTimeToMinutes(b.horaInicio),
          dbTimeToMinutes(b.horaFin),
        ),
      );
      const unblocked = candidates.filter(
        (s) => !blocking.some((b) => b.veterinarioId === s.veterinarioId),
      );
      const busy = data.occupancy.filter(
        (c) => c.fechaHora < fin && c.fechaHoraFin > inicio,
      );
      let estado:
        | 'Disponible'
        | 'Bloqueado'
        | 'Fuera de atención'
        | 'Ocupado'
        | 'Sin recursos';
      if (blocking.some((b) => b.veterinarioId === null)) estado = 'Bloqueado';
      else if (!candidates.length) estado = 'Fuera de atención';
      else if (!unblocked.length) estado = 'Bloqueado';
      else if (!data.rooms.length) estado = 'Sin recursos';
      else if (
        unblocked.some(
          (s) => !busy.some((c) => c.veterinarioId === s.veterinarioId),
        ) &&
        data.rooms.some((r) => !busy.some((c) => c.salaId === r.id))
      )
        estado = 'Disponible';
      else estado = 'Ocupado';
      return {
        inicio: storedDateTimeToInstant(inicio).toISOString(),
        fin: storedDateTimeToInstant(fin).toISOString(),
        fecha,
        hora: formatTime(minute),
        estado,
      };
    });
  });
}

@Injectable()
export class CalendarService {
  constructor(private readonly repo: CalendarRepository) {}
  branches() {
    return this.repo.branches();
  }
  async read(query: CalendarQueryDto) {
    const period = calendarPeriod(query.fecha, query.vista);
    const data = await this.repo.snapshot(
      query.sucursalId,
      period.inicio,
      period.fin,
      period.desde,
      period.hastaExclusiva,
    );
    if (!data.branch) throw new NotFoundException('Sucursal no encontrada');
    return {
      sucursal: data.branch,
      desde: period.desde,
      hastaExclusiva: period.hastaExclusiva,
      zonaHoraria: 'America/Guayaquil',
      citas: data.appointments.map(summary),
      franjas: calendarSlots(data, period.days),
    };
  }
  async detail(id: string, sucursalId: string) {
    const cita = await this.repo.detail(id, sucursalId);
    if (!cita) throw new NotFoundException('Cita no encontrada en la sucursal');
    return {
      ...summary(cita),
      cliente: name(cita.paciente.client.person),
      cedula: cita.paciente.client.person.identification,
      consultorio: cita.sala.nombre,
      sucursal: cita.sala.sucursal.nombre,
    };
  }
}
