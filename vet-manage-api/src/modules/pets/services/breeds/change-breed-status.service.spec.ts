import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AUDIT_ACTIONS, AUDIT_MODULES } from '../../../audit/audit.catalog.js';
import { PERMISSIONS_METADATA } from '../../../identity/decorators/require-permissions.decorator.js';
import { BreedController } from '../../routes/breed.controller.js';
import { BREED_STATUS_MESSAGES, ChangeBreedStatusService } from './change-breed-status.service.js';

type Tx = {
  breed: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

function build(tx: Tx) {
  const prisma = {
    $transaction: vi.fn(async (run: (transaction: Tx) => Promise<unknown>) => run(tx)),
  };
  const audit = { record: vi.fn(async () => undefined) };
  return { service: new ChangeBreedStatusService(prisma as never, audit as never), tx, audit };
}

function baseTx(overrides: Record<string, unknown> = {}): Tx {
  return {
    breed: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'breed-1',
        name: 'Labrador',
        isActive: true,
        updatedAt: new Date('2026-11-18T00:00:00.000Z'),
        species: { name: 'Canino' },
        ...overrides,
      }),
      update: vi.fn().mockResolvedValue({
        id: 'breed-1',
        isActive: false,
        updatedAt: new Date('2026-11-26T00:00:00.000Z'),
      }),
    },
  };
}

describe('ChangeBreedStatusService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inactiva una raza y registra la auditoría en la misma transacción', async () => {
    const tx = baseTx();
    const { service, audit } = build(tx);

    await expect(service.inactivate('breed-1', 'vet-1')).resolves.toEqual({
      message: BREED_STATUS_MESSAGES.inactivated,
      breed: {
        id: 'breed-1',
        isActive: false,
        updatedAt: new Date('2026-11-26T00:00:00.000Z'),
      },
    });
    expect(tx.breed.update).toHaveBeenCalledWith({
      where: { id: 'breed-1' },
      data: { isActive: false },
      select: { id: true, isActive: true, updatedAt: true },
    });
    expect(audit.record).toHaveBeenCalledWith(tx, {
      actorId: 'vet-1',
      action: AUDIT_ACTIONS.inactivate,
      module: AUDIT_MODULES.breeds,
      affectedRecord: 'Labrador (Canino)',
      previousValue: { status: 'Activa' },
      newValue: { status: 'Inactiva' },
    });
  });

  it('activa una raza inactiva y registra la transición', async () => {
    const tx = baseTx({ isActive: false });
    tx.breed.update.mockResolvedValue({
      id: 'breed-1',
      isActive: true,
      updatedAt: new Date('2026-11-26T00:00:00.000Z'),
    });
    const { service, audit } = build(tx);

    await expect(service.activate('breed-1', 'vet-1')).resolves.toMatchObject({
      message: BREED_STATUS_MESSAGES.activated,
      breed: { id: 'breed-1', isActive: true },
    });
    expect(tx.breed.update).toHaveBeenCalledWith(expect.objectContaining({ data: { isActive: true } }));
    expect(audit.record).toHaveBeenCalledWith(tx, expect.objectContaining({
      action: AUDIT_ACTIONS.activate,
      previousValue: { status: 'Inactiva' },
      newValue: { status: 'Activa' },
    }));
  });

  it('no vuelve a escribir ni auditar si la raza ya tiene el estado solicitado', async () => {
    const tx = baseTx({ isActive: false });
    const { service, audit } = build(tx);

    await service.inactivate('breed-1', 'vet-1');

    expect(tx.breed.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('devuelve 404 si la raza no existe', async () => {
    const tx = baseTx();
    tx.breed.findUnique.mockResolvedValue(null);
    const { service, audit } = build(tx);

    await expect(service.activate('missing-id', 'vet-1')).rejects.toMatchObject({
      statusCode: 404,
      message: BREED_STATUS_MESSAGES.notFound,
    });
    expect(tx.breed.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('exige breeds:change-status para activar e inactivar', () => {
    for (const method of ['activateBreed', 'inactivateBreed']) {
      const handler = Object.getOwnPropertyDescriptor(BreedController.prototype, method)?.value;
      expect(Reflect.getMetadata(PERMISSIONS_METADATA, handler)).toEqual(['breeds:change-status']);
    }
  });
});
