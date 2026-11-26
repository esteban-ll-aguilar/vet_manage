import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { ApiException } from '../../../../common/errors/api-exception.js';
import {
  dbTimeToMinutes,
  formatTime,
  isOnSlot,
  overlaps,
  parseTime,
} from '../../common/time-slots.js';
import type { AvailabilitySlotDto, SaveDailyAvailabilityDto } from '../dtos/daily-availability.dto.js';
import {
  DailyAvailabilityRepository,
  type AvailabilitySlotInput,
} from '../repositories/daily-availability.repository.js';

const WEEKDAYS = [
  'DOMINGO',
  'LUNES',
  'MARTES',
  'MIERCOLES',
  'JUEVES',
  'VIERNES',
  'SABADO',
] as const;

type Weekday = (typeof WEEKDAYS)[number];
type WorkBase = NonNullable<Awaited<ReturnType<DailyAvailabilityRepository['findBaseById']>>>;
type DailySlot = Awaited<ReturnType<DailyAvailabilityRepository['findSlots']>>[number];
type Appointment = Awaited<
  ReturnType<DailyAvailabilityRepository['findActiveAppointments']>
>[number];

export type AvailabilitySlotResponse = {
  id: string;
  horaInicio: string;
  horaFin: string;
};

export type AvailabilityJornadaResponse = {
  horarioBaseId: string;
  sucursalId: string;
  sucursalNombre: string;
  horaInicio: string;
  horaFin: string;
  franjas: AvailabilitySlotResponse[];
};

export type MyAvailabilityResponse = {
  fecha: string;
  diaSemana: Weekday;
  jornadas: AvailabilityJornadaResponse[];
};

// AAAA-MM-DD como fecha UTC, igual que las columnas @db.Date de Prisma.
function parseDate(value: string | undefined): Date {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException('La fecha debe tener formato YYYY-MM-DD');
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException('La fecha no es válida');
  }
  return date;
}

const formatDate = (date: Date): string => date.toISOString().slice(0, 10);

@Injectable()
export class DailyAvailabilityService {
  constructor(private readonly repo: DailyAvailabilityRepository) {}

  async getMine(veterinarioId: string, fechaValue?: string): Promise<MyAvailabilityResponse> {
    const fecha = parseDate(fechaValue);
    const diaSemana = this.weekdayOf(fecha);

    if (diaSemana === 'DOMINGO') {
      throw new BadRequestException('No existe horario base para la fecha');
    }

    if (diaSemana === 'SABADO') {
      const bases = await this.repo.findBasesForDay(veterinarioId, diaSemana);
      if (bases.length === 0) {
        throw new BadRequestException('No existe horario base para la fecha');
      }
      const shift = await this.repo.findSaturdayShift(veterinarioId, fecha);
      if (!shift) {
        throw new BadRequestException('El veterinario no tiene turno asignado para este sábado');
      }
      const slots = await this.repo.findSlots(shift.horarioBaseId, fecha);
      return this.buildResponse(fecha, diaSemana, [this.mapJornada(shift.horarioBase, slots)]);
    }

    const bases = await this.repo.findBasesForDay(veterinarioId, diaSemana);
    if (bases.length === 0) {
      throw new BadRequestException('No existe horario base para la fecha');
    }

    const jornadas = await Promise.all(
      bases.map(async (base) => this.mapJornada(base, await this.repo.findSlots(base.id, fecha))),
    );

    return this.buildResponse(fecha, diaSemana, jornadas);
  }

  async saveMine(
    veterinarioId: string,
    dto: SaveDailyAvailabilityDto,
  ): Promise<MyAvailabilityResponse> {
    const fecha = parseDate(dto.fecha);
    const diaSemana = this.weekdayOf(fecha);
    const base = await this.resolveOwnBase(veterinarioId, dto.horarioBaseId, fecha, diaSemana);

    const slots = this.parseSlots(base, dto.franjas);
    await this.ensureAppointmentsRemainCovered(veterinarioId, fecha, slots);

    const saved = await this.repo.replaceSlots(base.id, fecha, slots);
    return this.buildResponse(fecha, diaSemana, [this.mapJornada(base, saved)]);
  }

  async resetMine(
    veterinarioId: string,
    fechaValue: string | undefined,
    horarioBaseId: string | undefined,
  ): Promise<MyAvailabilityResponse> {
    const fecha = parseDate(fechaValue);
    const diaSemana = this.weekdayOf(fecha);
    if (!horarioBaseId) {
      throw new BadRequestException('La jornada es obligatoria');
    }

    const base = await this.resolveOwnBase(veterinarioId, horarioBaseId, fecha, diaSemana);
    await this.repo.clearSlots(base.id, fecha);

    return this.buildResponse(fecha, diaSemana, [this.mapJornada(base, [])]);
  }

  // La jornada debe ser del propio veterinario, corresponder al día de la fecha y,
  // en sábado, ser la que tiene asignada en el turno de esa fecha.
  private async resolveOwnBase(
    veterinarioId: string,
    horarioBaseId: string,
    fecha: Date,
    diaSemana: Weekday,
  ): Promise<WorkBase> {
    const base = await this.repo.findBaseById(horarioBaseId);
    if (!base) {
      throw new BadRequestException('No existe horario base para la fecha');
    }
    if (base.veterinarioId !== veterinarioId) {
      throw new ForbiddenException('No tiene permisos para esta acción');
    }
    if (base.diaSemana !== diaSemana) {
      throw new BadRequestException('No existe horario base para la fecha');
    }

    if (diaSemana === 'SABADO') {
      const shift = await this.repo.findSaturdayShift(veterinarioId, fecha);
      if (!shift || shift.horarioBaseId !== base.id) {
        throw new BadRequestException('El veterinario no tiene turno asignado para este sábado');
      }
    }

    return base;
  }

  private parseSlots(base: WorkBase, franjas: AvailabilitySlotDto[]): AvailabilitySlotInput[] {
    const baseStart = dbTimeToMinutes(base.horaInicio);
    const baseEnd = dbTimeToMinutes(base.horaFin);

    const slots = franjas.map((slot) => {
      const startMin = parseTime(slot.horaInicio);
      if (startMin === null) {
        throw new BadRequestException('La hora de inicio no tiene un formato válido (HH:mm)');
      }
      if (!isOnSlot(startMin)) {
        throw new BadRequestException('Las horas deben ser en punto o media hora');
      }

      const endMin = parseTime(slot.horaFin);
      if (endMin === null) {
        throw new BadRequestException('La hora de fin no tiene un formato válido (HH:mm)');
      }
      if (!isOnSlot(endMin)) {
        throw new BadRequestException('Las horas deben ser en punto o media hora');
      }
      if (endMin <= startMin) {
        throw new BadRequestException('La hora de fin debe ser posterior a la hora de inicio');
      }
      if (startMin < baseStart || endMin > baseEnd) {
        throw new BadRequestException('La disponibilidad diaria debe estar dentro del horario base');
      }

      return { startMin, endMin };
    });

    slots.sort((a, b) => a.startMin - b.startMin);
    for (let index = 1; index < slots.length; index++) {
      const previous = slots[index - 1];
      const current = slots[index];
      if (overlaps(previous.startMin, previous.endMin, current.startMin, current.endMin)) {
        throw new BadRequestException('Las franjas no pueden superponerse');
      }
    }

    return slots;
  }

  // Sin franjas se usa toda la jornada, así que no hay citas afectadas.
  private async ensureAppointmentsRemainCovered(
    veterinarioId: string,
    fecha: Date,
    slots: AvailabilitySlotInput[],
  ): Promise<void> {
    if (slots.length === 0) return;

    const appointments = await this.repo.findActiveAppointments(veterinarioId, fecha);
    const affected = appointments.filter((appointment) => {
      const start = this.minutesOf(appointment.fechaHora);
      const end = this.minutesOf(appointment.fechaHoraFin);
      return !this.isCovered(slots, start, end);
    });

    if (affected.length > 0) {
      throw new ApiException(
        'El cambio afecta una cita existente',
        409,
        affected.map((appointment) => this.describeAppointment(appointment)),
      );
    }
  }

  // Une las franjas y comprueba que la cita quede completamente dentro de una.
  private isCovered(slots: AvailabilitySlotInput[], start: number, end: number): boolean {
    const merged: AvailabilitySlotInput[] = [];
    for (const slot of [...slots].sort((a, b) => a.startMin - b.startMin)) {
      const last = merged[merged.length - 1];
      if (last && slot.startMin <= last.endMin) {
        last.endMin = Math.max(last.endMin, slot.endMin);
      } else {
        merged.push({ ...slot });
      }
    }
    return merged.some((slot) => slot.startMin <= start && slot.endMin >= end);
  }

  private describeAppointment(appointment: Appointment): string {
    const start = formatTime(this.minutesOf(appointment.fechaHora));
    const end = formatTime(this.minutesOf(appointment.fechaHoraFin));
    return [
      `Cita #${appointment.numero}`,
      `${start}–${end}`,
      appointment.estado,
      appointment.paciente.name,
      appointment.sala.nombre,
      appointment.sala.sucursal.nombre,
    ].join(' · ');
  }

  private mapJornada(base: WorkBase, slots: DailySlot[]): AvailabilityJornadaResponse {
    return {
      horarioBaseId: base.id,
      sucursalId: base.sucursalId,
      sucursalNombre: base.sucursal.nombre,
      horaInicio: formatTime(dbTimeToMinutes(base.horaInicio)),
      horaFin: formatTime(dbTimeToMinutes(base.horaFin)),
      franjas: slots.map((slot) => ({
        id: slot.id,
        horaInicio: formatTime(dbTimeToMinutes(slot.horaInicio)),
        horaFin: formatTime(dbTimeToMinutes(slot.horaFin)),
      })),
    };
  }

  private buildResponse(
    fecha: Date,
    diaSemana: Weekday,
    jornadas: AvailabilityJornadaResponse[],
  ): MyAvailabilityResponse {
    return { fecha: formatDate(fecha), diaSemana, jornadas };
  }

  private weekdayOf(fecha: Date): Weekday {
    return WEEKDAYS[fecha.getUTCDay()];
  }

  private minutesOf(value: Date): number {
    return value.getUTCHours() * 60 + value.getUTCMinutes();
  }
}
