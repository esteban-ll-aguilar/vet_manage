import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { WorkScheduleRepository } from '../repositories/work-schedule.repository.js';
import { toWorkScheduleResponse } from '../dtos/work-schedule-response.dto.js';
import type { UpdateWorkScheduleDto } from '../dtos/update-work-schedule.dto.js';
import { parseTime, isOnSlot, minutesToDbTime, dbTimeToMinutes } from '../../common/time-slots.js';

@Injectable()
export class UpdateWorkScheduleService {
  constructor(private readonly repo: WorkScheduleRepository) {}

  async update(id: string, dto: UpdateWorkScheduleDto) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException('Horario no encontrado');
    }

    const veterinarioId = dto.veterinarioId ?? existing.veterinarioId;
    const diaSemana = dto.diaSemana ?? existing.diaSemana;

    // Parse and validate times — use existing values when not provided
    const horaInicioStr = dto.horaInicio;
    const horaFinStr = dto.horaFin;

    let startMin: number;
    if (horaInicioStr !== undefined) {
      const parsed = parseTime(horaInicioStr);
      if (parsed === null) {
        throw new BadRequestException('La hora de inicio no tiene un formato válido (HH:mm)');
      }
      if (!isOnSlot(parsed)) {
        throw new BadRequestException('Las horas deben ser en punto o media hora');
      }
      startMin = parsed;
    } else {
      startMin = dbTimeToMinutes(existing.horaInicio);
    }

    let endMin: number;
    if (horaFinStr !== undefined) {
      const parsed = parseTime(horaFinStr);
      if (parsed === null) {
        throw new BadRequestException('La hora de fin no tiene un formato válido (HH:mm)');
      }
      if (!isOnSlot(parsed)) {
        throw new BadRequestException('Las horas deben ser en punto o media hora');
      }
      endMin = parsed;
    } else {
      endMin = dbTimeToMinutes(existing.horaFin);
    }

    if (endMin <= startMin) {
      throw new BadRequestException('La hora de fin debe ser posterior a la hora de inicio');
    }

    // Check overlapping schedules (excluding current)
    const overlapping = await this.repo.findOverlapping(
      veterinarioId,
      diaSemana,
      startMin,
      endMin,
      id,
    );
    if (overlapping.length > 0) {
      throw new BadRequestException(
        'El veterinario ya tiene otro horario asignado en ese mismo intervalo',
      );
    }

    const oldStartMin = dbTimeToMinutes(existing.horaInicio);
    const oldEndMin = dbTimeToMinutes(existing.horaFin);
    const isReduced = startMin > oldStartMin || endMin < oldEndMin;
    const isDayChanged = dto.diaSemana !== undefined && dto.diaSemana !== existing.diaSemana;
    const isVeterinarianChanged = dto.veterinarioId !== undefined && dto.veterinarioId !== existing.veterinarioId;
    const isSucursalChanged = dto.sucursalId !== undefined && dto.sucursalId !== existing.sucursalId;
    const isStructuralChange = isSucursalChanged || isDayChanged || isVeterinarianChanged;

    if (isReduced) {
      const removedRanges: Array<{ start: number; end: number }> = [];
      if (startMin > oldStartMin) removedRanges.push({ start: oldStartMin, end: startMin });
      if (endMin < oldEndMin) removedRanges.push({ start: endMin, end: oldEndMin });

      for (const range of removedRanges) {
        const conflictingAppointments = await this.repo.countConflictingAppointments(
          existing.veterinarioId,
          existing.diaSemana,
          range.start,
          range.end,
        );
        if (conflictingAppointments > 0) {
          throw new BadRequestException('El cambio afecta citas o disponibilidad diaria existente');
        }
      }

      const conflictingAvailability = await this.repo.countConflictingAvailability(
        id,
        startMin,
        endMin,
      );
      if (conflictingAvailability > 0) {
        throw new BadRequestException('El cambio afecta citas o disponibilidad diaria existente');
      }
    } else if (isStructuralChange) {
      const conflictingAppointments = await this.repo.countConflictingAppointments(
        existing.veterinarioId,
        existing.diaSemana,
        oldStartMin,
        oldEndMin,
      );
      if (conflictingAppointments > 0) {
        throw new BadRequestException('El cambio afecta citas o disponibilidad diaria existente');
      }

      const conflictingAvailability = await this.repo.countAvailability(id);
      if (conflictingAvailability > 0) {
        throw new BadRequestException('El cambio afecta citas o disponibilidad diaria existente');
      }
    }

    const updateData: Record<string, unknown> = {};
    if (dto.sucursalId !== undefined) updateData.sucursalId = dto.sucursalId;
    if (dto.diaSemana !== undefined) updateData.diaSemana = dto.diaSemana;
    if (dto.horaInicio !== undefined) updateData.horaInicio = minutesToDbTime(startMin);
    if (dto.horaFin !== undefined) updateData.horaFin = minutesToDbTime(endMin);
    if (dto.veterinarioId !== undefined) updateData.veterinarioId = dto.veterinarioId;

    const record = await this.repo.update(id, updateData);
    return toWorkScheduleResponse(record);
  }
}
