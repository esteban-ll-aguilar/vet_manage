import { dbTimeToMinutes, formatTime } from '../../common/time-slots.js';
import type { ConflictingAppointment, ScheduleBlockRecord } from '../repositories/schedule-block.repository.js';
import type { ScheduleBlockScope } from './schedule-block-input.js';

export type ScheduleBlockResponse = {
  id: string;
  sucursal: { id: string; nombre: string };
  alcance: ScheduleBlockScope;
  veterinario: { id: string; nombre: string } | null;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  motivo: string;
  registradoPor: string;
  creadoEn: string;
};

const fullName = (person: { firstName: string; lastName: string }) => `${person.firstName} ${person.lastName}`;
const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const timeOf = (date: Date) => formatTime(dbTimeToMinutes(date));

export function toScheduleBlockResponse(block: ScheduleBlockRecord): ScheduleBlockResponse {
  return {
    id: block.id,
    sucursal: block.sucursal,
    alcance: block.veterinario ? 'VETERINARIO' : 'SUCURSAL',
    veterinario: block.veterinario ? { id: block.veterinario.id, nombre: fullName(block.veterinario.person) } : null,
    fecha: isoDate(block.fecha),
    horaInicio: timeOf(block.horaInicio),
    horaFin: timeOf(block.horaFin),
    motivo: block.motivo,
    registradoPor: fullName(block.registradoPor.person),
    creadoEn: block.creadoEn.toISOString(),
  };
}

// Texto para ubicar la cita que impide el bloqueo, p. ej.
// "Cita N.° 12 · 03/11/2026 09:30–10:00 · Paciente Luna · Valentina Ruiz · Consultorio 1".
export function describeAppointment(cita: ConflictingAppointment): string {
  const [year, month, day] = isoDate(cita.fechaHora).split('-');
  return [
    `Cita N.° ${cita.numero}`,
    `${day}/${month}/${year} ${timeOf(cita.fechaHora)}–${timeOf(cita.fechaHoraFin)}`,
    `Paciente ${cita.paciente.name}`,
    fullName(cita.veterinario.person),
    cita.sala.nombre,
  ].join(' · ');
}
