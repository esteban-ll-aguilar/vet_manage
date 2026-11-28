import { ApiException } from '../../../../common/errors/api-exception.js';

export const CANCELLATION_MESSAGES = {
  invalidStatus: 'El estado de la cita no permite cancelaciones',
  approvedPayment: 'La cancelación de una cita pagada requiere autorización de Administrador o Gerente',
  insufficientTime: 'La cancelación requiere al menos 24 horas de anticipación',
  requiredReason: 'Ingrese el motivo de cancelación',
} as const;

const MINIMUM_ADVANCE_MS = 24 * 60 * 60 * 1000;

const PAYABLE_STATUSES = ['PROGRAMADA', 'CONFIRMADA'] as const;

export type CancellationInput = {
  estado: string;
  fechaHora: Date;
  tienePagoAprobado: boolean;
  motivo: string;
};

export function validateCancellation(
  input: CancellationInput,
  now = new Date(),
): string {
  // Una cita pagada (Programada o Confirmada) solo se cancela con autorización del Administrador o Gerente.
  if (
    input.tienePagoAprobado &&
    (PAYABLE_STATUSES as readonly string[]).includes(input.estado)
  ) {
    throw new ApiException(
      CANCELLATION_MESSAGES.approvedPayment,
      409,
      [],
      'APPOINTMENT_APPROVED_PAYMENT',
    );
  }

  if (input.estado !== 'PROGRAMADA') {
    throw new ApiException(
      CANCELLATION_MESSAGES.invalidStatus,
      409,
      [],
      'APPOINTMENT_INVALID_STATUS',
    );
  }

  // Agendamiento almacena la hora local como UTC.
  // Convertir el instante actual a la misma convención.
  const ECUADOR_OFFSET_MS = 5 * 60 * 60 * 1000;
  const localNow = now.getTime() - ECUADOR_OFFSET_MS;
  const advance = input.fechaHora.getTime() - localNow;

  if (!Number.isFinite(advance) || advance < MINIMUM_ADVANCE_MS) {
    throw new ApiException(
      CANCELLATION_MESSAGES.insufficientTime,
      400,
      [],
      'APPOINTMENT_INSUFFICIENT_ADVANCE',
    );
  }

  const motivo = typeof input.motivo === 'string'
    ? input.motivo.trim()
    : '';

  if (!motivo) {
    throw new ApiException(
      CANCELLATION_MESSAGES.requiredReason,
      400,
      [],
      'APPOINTMENT_REASON_REQUIRED',
    );
  }

  return motivo;
}
