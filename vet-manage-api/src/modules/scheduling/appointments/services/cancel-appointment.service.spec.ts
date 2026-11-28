import { describe, expect, it, vi } from 'vitest';
import {
  CancelAppointmentService,
  CANCEL_APPOINTMENT_MESSAGES as M,
} from './cancel-appointment.service.js';
import { CANCELLATION_MESSAGES as R } from './cancellation-rules.js';

const ID = '33333333-3333-4333-8333-333333333333';
const ACTOR_ID = 'receptionist-1';
const NOW = new Date('2026-11-01T10:00:00-05:00');
const REASON = 'El cliente no podrá asistir';

function build() {
  const db = {};

  const appointment = {
    id: ID,
    numero: 1,
    estado: 'PROGRAMADA',
    fechaHora: new Date('2026-11-02T10:00:00.000Z'),
    pagos: [] as { id: string }[],
  };

  const result = {
    id: ID,
    estado: 'CANCELADA',
    motivo: REASON,
    canceladaPorId: ACTOR_ID,
    fechaCancelacion: NOW.toISOString(),
  };

  const repository = {
    transaction: vi.fn(
      async (operation: (tx: object) => Promise<unknown>) =>
        operation(db),
    ),
    findForCancellation: vi.fn(
      async () => appointment as typeof appointment | null,
    ),
    cancel: vi.fn(
      async () => result as typeof result | null,
    ),
  };

  const service = new CancelAppointmentService(
    repository as never,
  );

  return {
    service,
    repository,
    appointment,
    result,
    db,
  };
}

describe('CancelAppointmentService - HU-005', () => {
  it('CP-005-01: cancela una cita exactamente 24 horas antes', async () => {
    const { service, repository, result, db } = build();

    await expect(
      service.execute(ID, REASON, ACTOR_ID, NOW),
    ).resolves.toEqual(result);

    expect(repository.transaction).toHaveBeenCalledTimes(1);

    expect(repository.findForCancellation)
      .toHaveBeenCalledWith(ID, db);

    expect(repository.cancel)
      .toHaveBeenCalledWith(
        ID, REASON, ACTOR_ID, NOW, db,
      );
  });

  it('CP-005-02: no modifica una cita con menos de 24 horas', async () => {
    const { service, repository } = build();

    const now = new Date('2026-11-01T10:01:00-05:00');

    await expect(
      service.execute(ID, REASON, ACTOR_ID, now),
    ).rejects.toThrow(R.insufficientTime);

    expect(repository.cancel).not.toHaveBeenCalled();
  });

  it.each([
    ['CP-005-03', ''],
    ['CP-005-04', '   '],
  ])('%s: no modifica una cita sin motivo válido', async (_, reason) => {
    const { service, repository } = build();

    await expect(
      service.execute(ID, reason, ACTOR_ID, NOW),
    ).rejects.toThrow(R.requiredReason);

    expect(repository.cancel).not.toHaveBeenCalled();
  });

  it('CP-005-05: no cancela una cita con pago aprobado', async () => {
    const { service, repository, appointment } = build();

    appointment.pagos = [{ id: 'payment-1' }];

    await expect(
      service.execute(ID, REASON, ACTOR_ID, NOW),
    ).rejects.toThrow(R.approvedPayment);

    expect(repository.cancel).not.toHaveBeenCalled();
  });

  it.each([
    ['CP-005-06', 'EN_CURSO'],
    ['CP-005-07', 'FINALIZADA'],
    ['CP-005-08', 'CANCELADA'],
    ['CP-005-09', 'NO_ASISTIO'],
    ['Complementario', 'CONFIRMADA'],
  ])('%s: rechaza el estado %s', async (_, estado) => {
    const { service, repository, appointment } = build();

    appointment.estado = estado;

    await expect(
      service.execute(ID, REASON, ACTOR_ID, NOW),
    ).rejects.toThrow(R.invalidStatus);

    expect(repository.cancel).not.toHaveBeenCalled();
  });

  it('rechaza una cita inexistente', async () => {
    const { service, repository } = build();

    repository.findForCancellation.mockResolvedValueOnce(null);

    await expect(
      service.execute(ID, REASON, ACTOR_ID, NOW),
    ).rejects.toThrow(M.notFound);

    expect(repository.cancel).not.toHaveBeenCalled();
  });

  it('rechaza un identificador inválido', async () => {
    const { service, repository } = build();

    await expect(
      service.execute('invalid-id', REASON, ACTOR_ID, NOW),
    ).rejects.toThrow(M.notFound);

    expect(repository.transaction).not.toHaveBeenCalled();
  });

  it('rechaza una modificación concurrente', async () => {
    const { service, repository } = build();

    repository.cancel.mockResolvedValueOnce(null);

    await expect(
      service.execute(ID, REASON, ACTOR_ID, NOW),
    ).rejects.toThrow(M.conflict);
  });

  it('controla conflictos de transacciones Prisma', async () => {
    const { service, repository } = build();

    repository.transaction.mockRejectedValueOnce({
      code: 'P2034',
    });

    await expect(
      service.execute(ID, REASON, ACTOR_ID, NOW),
    ).rejects.toThrow(M.conflict);
  });

  it('propaga errores inesperados del repositorio', async () => {
    const { service, repository } = build();

    repository.transaction.mockRejectedValueOnce(
      new Error('Error de persistencia'),
    );

    await expect(
      service.execute(ID, REASON, ACTOR_ID, NOW),
    ).rejects.toThrow('Error de persistencia');
  });
});
