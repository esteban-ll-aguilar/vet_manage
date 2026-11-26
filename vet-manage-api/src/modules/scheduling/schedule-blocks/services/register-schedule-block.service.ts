import { Injectable } from '@nestjs/common';
import { ApiException } from '../../../../common/errors/api-exception.js';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import { minutesToDbTime } from '../../common/time-slots.js';
import { ScheduleBlockRepository } from '../repositories/schedule-block.repository.js';
import { describeAppointment, toScheduleBlockResponse, type ScheduleBlockResponse } from './schedule-block.mapper.js';
import { validateScheduleBlockInput, type ScheduleBlockInput } from './schedule-block-input.js';

export const REGISTER_BLOCK_MESSAGES = {
  invalid: 'Revise los datos del bloqueo',
  branchNotFound: 'La sucursal seleccionada no existe',
  branchInactive: 'La sucursal seleccionada no está activa',
  veterinarianNotFound: 'El veterinario seleccionado no existe o no está activo',
  appointmentConflict: 'El bloqueo afecta una cita existente',
} as const;

const MINUTE_MS = 60_000;

@Injectable()
export class RegisterScheduleBlockService {
  constructor(
    private readonly blocks: ScheduleBlockRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: ScheduleBlockInput, actorId: string): Promise<ScheduleBlockResponse> {
    const validation = validateScheduleBlockInput(input);
    if (!validation.valid) {
      const messages = Object.values(validation.errors);
      throw new ApiException(messages[0] ?? REGISTER_BLOCK_MESSAGES.invalid, 400, messages, 'SCHEDULE_BLOCK_INVALID');
    }
    const data = validation.value;

    const branch = await this.blocks.findBranch(data.sucursalId);
    if (!branch) throw new ApiException(REGISTER_BLOCK_MESSAGES.branchNotFound, 404, [], 'SCHEDULE_BLOCK_BRANCH_NOT_FOUND');
    if (!branch.estado) throw new ApiException(REGISTER_BLOCK_MESSAGES.branchInactive, 409, [], 'SCHEDULE_BLOCK_BRANCH_INACTIVE');

    if (data.veterinarioId && !(await this.blocks.findActiveVeterinarian(data.veterinarioId))) {
      throw new ApiException(REGISTER_BLOCK_MESSAGES.veterinarianNotFound, 404, [], 'SCHEDULE_BLOCK_VETERINARIAN_NOT_FOUND');
    }

    const inicio = new Date(data.fecha.getTime() + data.inicio * MINUTE_MS);
    const fin = new Date(data.fecha.getTime() + data.fin * MINUTE_MS);

    // La revisión de citas y el registro van en la misma transacción. Si hay citas,
    // se rechaza: el bloqueo nunca cancela ni cambia citas.
    const created = await this.prisma.$transaction(async (tx) => {
      const conflicts = await this.blocks.findConflictingAppointments(
        { sucursalId: data.sucursalId, veterinarioId: data.veterinarioId, inicio, fin },
        tx,
      );
      if (conflicts.length > 0) {
        throw new ApiException(
          REGISTER_BLOCK_MESSAGES.appointmentConflict,
          409,
          conflicts.map(describeAppointment),
          'SCHEDULE_BLOCK_APPOINTMENT_CONFLICT',
        );
      }

      return this.blocks.create({
        sucursalId: data.sucursalId,
        veterinarioId: data.veterinarioId,
        fecha: data.fecha,
        horaInicio: minutesToDbTime(data.inicio),
        horaFin: minutesToDbTime(data.fin),
        motivo: data.motivo,
        registradoPorId: actorId,
      }, tx);
    });

    return toScheduleBlockResponse(created);
  }
}
