import { Injectable } from '@nestjs/common';
import { ApiException } from '../../../../common/errors/api-exception.js';
import { AppointmentsRepository } from '../repositories/appointments.repository.js';
import { validateCancellation } from './cancellation-rules.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const CANCEL_APPOINTMENT_MESSAGES = {
  notFound: 'La cita no existe',
  conflict: 'La cita fue modificada. Actualice la información e intente nuevamente',
} as const;

@Injectable()
export class CancelAppointmentService {
  constructor(
    private readonly appointments: AppointmentsRepository,
  ) {}

  async execute(
    id: string,
    motivo: string,
    actorId: string,
    now = new Date(),
  ) {
    if (!UUID_PATTERN.test(id)) {
      throw this.notFound();
    }

    try {
      return await this.appointments.transaction(async (db) => {
        const appointment =
          await this.appointments.findForCancellation(id, db);

        if (!appointment) {
          throw this.notFound();
        }

        const validReason = validateCancellation(
          {
            estado: appointment.estado,
            fechaHora: appointment.fechaHora,
            tienePagoAprobado: appointment.pagos.length > 0,
            motivo,
          },
          now,
        );

        const cancelled = await this.appointments.cancel(
          id,
          validReason,
          actorId,
          now,
          db,
        );

        if (!cancelled) {
          throw this.conflict();
        }

        return cancelled;
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2034'
      ) {
        throw this.conflict();
      }

      throw error;
    }
  }

  private notFound() {
    return new ApiException(
      CANCEL_APPOINTMENT_MESSAGES.notFound,
      404,
      [],
      'APPOINTMENT_NOT_FOUND',
    );
  }

  private conflict() {
    return new ApiException(
      CANCEL_APPOINTMENT_MESSAGES.conflict,
      409,
      [],
      'APPOINTMENT_CONFLICT',
    );
  }
}
