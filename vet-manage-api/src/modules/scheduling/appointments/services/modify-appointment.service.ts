import { Injectable } from '@nestjs/common';
import { ApiException } from '../../../../common/errors/api-exception.js';
import { APPOINTMENT_MESSAGES } from '../appointment-messages.js';
import type { ModifyAppointmentDto } from '../dtos/modify-appointment.dto.js';
import { AppointmentModificationRepository } from '../repositories/appointment-modification.repository.js';
import {
  MODIFIABLE_STATUSES,
  assertScheduleChangeAvailable,
  planModification,
  toLocalDateTime,
} from './modification-rules.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MODIFY_APPOINTMENT_MESSAGES = {
  notFound: 'La cita no existe',
  conflict: 'La cita fue modificada. Actualice la información e intente nuevamente',
  inactiveVeterinarian: 'El veterinario no está activo',
  roomNotInBranch: 'El consultorio no pertenece a la sucursal de la cita o no está activo',
} as const;

const fullName = (person: { firstName: string; lastName: string }) =>
  [person.firstName, person.lastName].filter(Boolean).join(' ');

@Injectable()
export class ModifyAppointmentService {
  constructor(private readonly repository: AppointmentModificationRepository) {}

  // Datos de la cita para el formulario de modificación.
  async getDetail(id: string) {
    if (!UUID_PATTERN.test(id)) throw this.notFound();

    const appointment = await this.repository.findDetail(id);
    if (!appointment) throw this.notFound();

    const client = appointment.paciente.client;
    const inicio = toLocalDateTime(appointment.fechaHora);
    const fin = toLocalDateTime(appointment.fechaHoraFin);

    return {
      id: appointment.id,
      numero: appointment.numero,
      estado: appointment.estado,
      modificable: (MODIFIABLE_STATUSES as readonly string[]).includes(appointment.estado),
      fecha: inicio.fecha,
      horaInicio: inicio.hora,
      horaFin: fin.hora,
      duracionMin: (appointment.fechaHoraFin.getTime() - appointment.fechaHora.getTime()) / 60_000,
      sucursal: appointment.sala.sucursal,
      servicio: appointment.servicio?.nombre ?? null,
      paciente: appointment.paciente.name,
      cliente: { nombre: fullName(client.person), cedula: client.person.identification },
      veterinarioId: appointment.veterinarioId,
      veterinario: fullName(appointment.veterinario.person),
      salaId: appointment.salaId,
      sala: appointment.sala.nombre,
      importeReserva: appointment.importeReserva.toString(),
      tienePagoAprobado: appointment.pagos.length > 0,
      cambioHorarioUtilizado: await this.repository.clientHasChangedSchedule(client.id),
    };
  }

  async execute(id: string, input: ModifyAppointmentDto, actorId: string, now = new Date()) {
    if (!UUID_PATTERN.test(id)) throw this.notFound();

    return this.repository.transaction(async (db) => {
      await this.repository.lock([`appointment:id:${id}`], db);

      const current = await this.repository.findForModification(id, db);
      if (!current) throw this.notFound();

      const plan = planModification(current, input, now);
      const changes = {
        start: plan.start,
        end: plan.end,
        veterinarioId: input.veterinarioId,
        salaId: input.salaId,
      };

      // Se reserva el nuevo horario antes de liberar el anterior, con los mismos bloqueos que el registro.
      await this.repository.lock(
        [
          `appointment:room:${changes.salaId}`,
          `appointment:veterinarian:${changes.veterinarioId}`,
          ...(plan.scheduleChanged ? [`appointment:client:${current.paciente.clientId}`] : []),
        ],
        db,
      );

      if (plan.scheduleChanged) {
        const alreadyChanged = await this.repository.clientHasChangedSchedule(
          current.paciente.clientId,
          db,
        );
        assertScheduleChangeAvailable(plan, alreadyChanged);
      }

      if (plan.veterinarianChanged) {
        const veterinarian = await this.repository.findActiveVeterinarian(changes.veterinarioId, now, db);
        if (!veterinarian) throw ApiException.badRequest(MODIFY_APPOINTMENT_MESSAGES.inactiveVeterinarian);
      }

      if (plan.roomChanged) {
        const room = await this.repository.findActiveRoom(changes.salaId, current.sala.sucursalId, db);
        if (!room) throw ApiException.badRequest(MODIFY_APPOINTMENT_MESSAGES.roomNotInBranch);
      }

      const slot = {
        sucursalId: current.sala.sucursalId,
        veterinarioId: changes.veterinarioId,
        date: plan.date,
        startMinutes: plan.startMinutes,
        endMinutes: plan.endMinutes,
      };

      // El veterinario debe atender el nuevo intervalo dentro de su jornada en la sucursal.
      if (!(await this.repository.isWithinWorkingHours(slot, db))) {
        throw ApiException.conflict(APPOINTMENT_MESSAGES.outsideWorkingHours);
      }

      const block = await this.repository.findBlock(slot, db);
      if (block) throw ApiException.conflict(APPOINTMENT_MESSAGES.blocked);

      const conflicts = await this.repository.findConflicts(id, changes, db);
      if (conflicts.some((item) => item.veterinarioId === changes.veterinarioId)) {
        throw ApiException.conflict(APPOINTMENT_MESSAGES.veterinarianUnavailable);
      }
      if (conflicts.some((item) => item.salaId === changes.salaId)) {
        throw ApiException.conflict(APPOINTMENT_MESSAGES.roomUnavailable);
      }

      const updated = await this.repository.update(current, changes, db);
      if (updated !== 1) throw this.conflict();

      if (plan.scheduleChanged) {
        await this.repository.recordScheduleChange(current, plan.start, actorId, now, db);
      }

      const appointment = await this.repository.findUpdated(id, db);
      const inicio = toLocalDateTime(appointment.fechaHora);

      return {
        id: appointment.id,
        numero: appointment.numero,
        estado: appointment.estado,
        fecha: inicio.fecha,
        horaInicio: inicio.hora,
        horaFin: toLocalDateTime(appointment.fechaHoraFin).hora,
        veterinarioId: appointment.veterinarioId,
        salaId: appointment.salaId,
        cambioHorarioUtilizado: plan.scheduleChanged,
      };
    });
  }

  private notFound() {
    return new ApiException(MODIFY_APPOINTMENT_MESSAGES.notFound, 404, [], 'APPOINTMENT_NOT_FOUND');
  }

  private conflict() {
    return new ApiException(MODIFY_APPOINTMENT_MESSAGES.conflict, 409, [], 'APPOINTMENT_CONFLICT');
  }
}
