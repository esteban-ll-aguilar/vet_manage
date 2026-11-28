import { describe, expect, it } from 'vitest';
import {
  validateCancellation,
  CANCELLATION_MESSAGES as M,
  type CancellationInput,
} from './cancellation-rules.js';

const NOW = new Date('2026-11-01T10:00:00-05:00');

function appointment(
  overrides: Partial<CancellationInput> = {},
): CancellationInput {
  return {
    estado: 'PROGRAMADA',
    fechaHora: new Date('2026-11-02T10:00:00.000Z'),
    tienePagoAprobado: false,
    motivo: 'El cliente no podrá asistir',
    ...overrides,
  };
}

describe('HU-005 - Reglas de cancelación de citas', () => {
  it('CP-005-01: permite cancelar exactamente 24 horas antes', () => {
    expect(
      validateCancellation(appointment(), NOW),
    ).toBe('El cliente no podrá asistir');
  });

  it('CP-005-02: rechaza cancelar con menos de 24 horas', () => {
    const now = new Date('2026-11-01T10:01:00-05:00');

    expect(() =>
      validateCancellation(appointment(), now),
    ).toThrow(M.insufficientTime);
  });

  it('CP-005-03: rechaza un motivo vacío', () => {
    expect(() =>
      validateCancellation(appointment({ motivo: '' }), NOW),
    ).toThrow(M.requiredReason);
  });

  it('CP-005-04: rechaza un motivo con solo espacios', () => {
    expect(() =>
      validateCancellation(appointment({ motivo: '   ' }), NOW),
    ).toThrow(M.requiredReason);
  });

  it('CP-005-05: rechaza una cita con pago aprobado', () => {
    expect(() =>
      validateCancellation(
        appointment({ tienePagoAprobado: true }),
        NOW,
      ),
    ).toThrow(M.approvedPayment);
  });

  it('CP-005-05: una cita Confirmada con pago aprobado pide autorización', () => {
    expect(() =>
      validateCancellation(
        appointment({ estado: 'CONFIRMADA', tienePagoAprobado: true }),
        NOW,
      ),
    ).toThrow(M.approvedPayment);
  });

  it('CP-005-05: el mensaje de autorización aparece antes que el de plazo', () => {
    const now = new Date('2026-11-02T09:00:00-05:00'); // una hora antes de la cita

    expect(() =>
      validateCancellation(
        appointment({ estado: 'CONFIRMADA', tienePagoAprobado: true }),
        now,
      ),
    ).toThrow(M.approvedPayment);
  });

  it('una cita Confirmada sin pago aprobado no admite la cancelación ordinaria', () => {
    expect(() =>
      validateCancellation(
        appointment({ estado: 'CONFIRMADA' }),
        NOW,
      ),
    ).toThrow(M.invalidStatus);
  });

  it('CP-005-06: rechaza una cita en curso', () => {
    expect(() =>
      validateCancellation(
        appointment({ estado: 'EN_CURSO' }),
        NOW,
      ),
    ).toThrow(M.invalidStatus);
  });

  it('CP-005-07: rechaza una cita finalizada', () => {
    expect(() =>
      validateCancellation(
        appointment({ estado: 'FINALIZADA' }),
        NOW,
      ),
    ).toThrow(M.invalidStatus);
  });

  it('CP-005-08: rechaza una cita ya cancelada', () => {
    expect(() =>
      validateCancellation(
        appointment({ estado: 'CANCELADA' }),
        NOW,
      ),
    ).toThrow(M.invalidStatus);
  });

  it('CP-005-09: rechaza una cita no asistida', () => {
    expect(() =>
      validateCancellation(
        appointment({ estado: 'NO_ASISTIO' }),
        NOW,
      ),
    ).toThrow(M.invalidStatus);
  });

  it('rechaza una cita confirmada', () => {
    expect(() =>
      validateCancellation(
        appointment({ estado: 'CONFIRMADA' }),
        NOW,
      ),
    ).toThrow(M.invalidStatus);
  });

  it('elimina los espacios sobrantes del motivo', () => {
    expect(
      validateCancellation(
        appointment({ motivo: '  Motivo válido  ' }),
        NOW,
      ),
    ).toBe('Motivo válido');
  });

  it('permite cancelar con más de 24 horas', () => {
    const now = new Date('2026-11-01T09:59:00-05:00');

    expect(
      validateCancellation(appointment(), now),
    ).toBe('El cliente no podrá asistir');
  });
});
