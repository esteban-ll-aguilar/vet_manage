import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { dbTimeToMinutes, formatTime, overlaps } from '../../common/time-slots.js';
import type { GenerateSaturdayShiftsDto, SubstituteSaturdayShiftDto } from '../dtos/saturday-shift.dto.js';
import { SaturdayShiftRepository } from '../repositories/saturday-shift.repository.js';

const parseDate = (value: string): Date => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException('La fecha debe tener formato YYYY-MM-DD');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException('La fecha no es válida');
  }
  return date;
};

@Injectable()
export class SaturdayShiftService {
  constructor(private readonly repo: SaturdayShiftRepository) {}

  list(sucursalId?: string, fechaDesde?: string, fechaHasta?: string) {
    return this.repo.findList(
      sucursalId,
      fechaDesde ? parseDate(fechaDesde) : undefined,
      fechaHasta ? parseDate(fechaHasta) : undefined,
    );
  }

  async generate(dto: GenerateSaturdayShiftsDto) {
    if (dto.asignaciones?.length) {
      const counts = new Map<string, number>();
      for (const assignment of dto.asignaciones) {
        const sucursalId = assignment.sucursalId ?? dto.sucursalId;
        counts.set(`${sucursalId}:${assignment.fecha}`, (counts.get(`${sucursalId}:${assignment.fecha}`) ?? 0) + 1);
      }
      if ([...counts.values()].some((count) => count > 1)) {
        throw new BadRequestException('Debe existir un único veterinario por sucursal y sábado');
      }
    }

    const assignments = dto.asignaciones?.map((assignment) => ({
      fecha: parseDate(assignment.fecha),
      veterinarioId: assignment.veterinarioId,
      sucursalId: assignment.sucursalId ?? dto.sucursalId,
    })) ?? dto.fechas.map((fecha, index) => ({
      fecha: parseDate(fecha),
      veterinarioId: dto.veterinarioIds[index % dto.veterinarioIds.length],
      sucursalId: dto.sucursalId,
    }));

    if (assignments.length === 0) throw new BadRequestException('Debe indicar al menos una fecha');

    const saved = [];
    const accepted: Array<{ veterinarioId: string; sucursalId: string; fecha: Date; start: number; end: number }> = [];
    for (const assignment of assignments) {
      if (assignment.fecha.getUTCDay() !== 6) {
        throw new BadRequestException('La fecha debe ser un sábado');
      }
      const base = await this.repo.findSaturdayBase(assignment.veterinarioId, assignment.sucursalId);
      if (!base) throw new BadRequestException('No existe horario base para este sábado');

      const start = dbTimeToMinutes(base.horaInicio);
      const end = dbTimeToMinutes(base.horaFin);
      for (const other of accepted) {
        if (
          other.veterinarioId === assignment.veterinarioId &&
          other.sucursalId !== assignment.sucursalId &&
          other.fecha.getTime() === assignment.fecha.getTime() &&
          overlaps(other.start, other.end, start, end)
        ) {
          throw new BadRequestException('El veterinario ya tiene otro horario asignado en ese mismo intervalo');
        }
      }
      const crossing = await this.repo.findCrossingAssignments(
        assignment.veterinarioId,
        assignment.fecha,
        start,
        end,
        assignment.sucursalId,
      );
      if (crossing.length > 0) {
        throw new BadRequestException('El veterinario ya tiene otro horario asignado en ese mismo intervalo');
      }

      try {
        const existing = await this.repo.findOne?.(assignment.sucursalId, assignment.fecha);
        saved.push(existing
          ? await this.repo.upsert(assignment.sucursalId, assignment.fecha, base.id, null)
          : await (this.repo.createOnce
            ? this.repo.createOnce(assignment.sucursalId, assignment.fecha, base.id)
            : this.repo.upsert(assignment.sucursalId, assignment.fecha, base.id, null)));
      } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
          throw new BadRequestException('Debe existir un único veterinario por sucursal y sábado');
        }
        throw error;
      }
      accepted.push({ veterinarioId: assignment.veterinarioId, sucursalId: assignment.sucursalId, fecha: assignment.fecha, start, end });
    }
    return saved;
  }

  async substitute(id: string, dto: SubstituteSaturdayShiftDto) {
    const current = await this.repo.findById(id);
    if (!current) throw new BadRequestException('El turno de sábado no existe');
    if (!dto.justificacion?.trim()) throw new BadRequestException('La justificación es obligatoria');

    const base = await this.repo.findSaturdayBase(dto.veterinarioId, current.sucursalId);
    if (!base) throw new BadRequestException('No existe horario base para este sábado');

    const start = dbTimeToMinutes(base.horaInicio);
    const end = dbTimeToMinutes(base.horaFin);
    if (!overlaps(start, end, start, end)) throw new BadRequestException('El reemplazo no cubre la jornada');

    const currentStart = dbTimeToMinutes(current.horarioBase.horaInicio);
    const currentEnd = dbTimeToMinutes(current.horarioBase.horaFin);
    if (start !== currentStart || end !== currentEnd) {
      throw new BadRequestException('El reemplazo debe cubrir toda la jornada');
    }

    const crossing = await this.repo.findCrossingAssignments(dto.veterinarioId, current.fecha, start, end, current.sucursalId);
    if (crossing.length > 0) {
      throw new BadRequestException('El veterinario ya tiene otro horario asignado en ese mismo intervalo');
    }

    const oldVeterinarianId = current.horarioBase.veterinarioId;
    if (oldVeterinarianId !== dto.veterinarioId) {
      const appointments = await this.repo.findAppointments(oldVeterinarianId, current.fecha);
      if (appointments.length > 0) {
        const affected = appointments.map((appointment) => ({
          numero: appointment.numero,
          fechaHora: appointment.fechaHora,
          fechaHoraFin: appointment.fechaHoraFin,
          estado: appointment.estado,
          paciente: appointment.paciente.name,
          cliente: `${appointment.paciente.client.person.firstName} ${appointment.paciente.client.person.lastName}`,
          consultorio: appointment.sala.nombre,
          sucursal: appointment.sala.sucursal.nombre,
        }));
        throw new ConflictException({
          message: 'El cambio afecta una cita existente',
          citas: affected,
        });
      }
    }

    return this.repo.substitute(id, base.id, dto.justificacion.trim());
  }

  mapShift(record: Awaited<ReturnType<SaturdayShiftRepository['findById']>>) {
    if (!record) return null;
    return {
      id: record.id,
      fecha: record.fecha,
      justificacion: record.justificacion,
      sucursalId: record.sucursalId,
      sucursalNombre: record.sucursal.nombre,
      veterinarioId: record.horarioBase.veterinarioId,
      veterinarioNombre: `${record.horarioBase.veterinario.person.firstName} ${record.horarioBase.veterinario.person.lastName}`,
      horaInicio: formatTime(dbTimeToMinutes(record.horarioBase.horaInicio)),
      horaFin: formatTime(dbTimeToMinutes(record.horarioBase.horaFin)),
    };
  }
}
