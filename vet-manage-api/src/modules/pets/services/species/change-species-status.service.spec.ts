import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS_METADATA } from '../../../identity/decorators/require-permissions.decorator.js';
import { SpeciesController } from '../../routes/species.controller.js';
import { ChangeSpeciesStatusService, SPECIES_STATUS_MESSAGES } from './change-species-status.service.js';

function build(isActive = true) {
  const existing = {
    id: 'sp-1',
    name: 'Canino',
    description: 'Perros domésticos',
    isActive,
    createdAt: new Date('2026-11-01T00:00:00Z'),
    updatedAt: new Date('2026-11-01T00:00:00Z'),
  };
  const tx = { species: { findUnique: vi.fn().mockResolvedValue(existing) } };
  const speciesRepository = {
    updateStatus: vi.fn(async (id: string, value: boolean) => ({ ...existing, id, isActive: value, updatedAt: new Date() })),
  };
  const prisma = { $transaction: vi.fn(async (run: (client: typeof tx) => Promise<unknown>) => run(tx)) };
  const audit = { record: vi.fn(async () => undefined) };
  const service = new ChangeSpeciesStatusService(speciesRepository as never, prisma as never, audit as never);
  return { service, speciesRepository, audit, tx, existing };
}

describe('ChangeSpeciesStatusService (HU-15)', () => {
  it('inactiva una especie activa y audita en la misma transacción', async () => {
    const { service, speciesRepository, audit, tx } = build(true);

    const result = await service.execute('sp-1', false, 'u-vet');

    expect(result.message).toBe('Especie inactivada correctamente');
    expect(result.species).toMatchObject({ id: 'sp-1', name: 'Canino', isActive: false });
    expect(speciesRepository.updateStatus).toHaveBeenCalledWith('sp-1', false, tx);
    expect(audit.record).toHaveBeenCalledWith(tx, {
      actorId: 'u-vet',
      action: 'Inactivar',
      module: 'Especies',
      affectedRecord: 'Canino',
      previousValue: { status: 'Activa' },
      newValue: { status: 'Inactiva' },
    });
  });

  it('activa una especie inactiva y audita', async () => {
    const { service, speciesRepository, audit, tx } = build(false);

    const result = await service.execute('sp-1', true, 'u-vet');

    expect(result.message).toBe('Especie activada correctamente');
    expect(result.species.isActive).toBe(true);
    expect(speciesRepository.updateStatus).toHaveBeenCalledWith('sp-1', true, tx);
    expect(audit.record).toHaveBeenCalledWith(tx, expect.objectContaining({
      action: 'Activar',
      previousValue: { status: 'Inactiva' },
      newValue: { status: 'Activa' },
    }));
  });

  it.each([[true, SPECIES_STATUS_MESSAGES.activated], [false, SPECIES_STATUS_MESSAGES.inactivated]])(
    'no escribe ni audita si la especie ya tiene isActive=%s',
    async (isActive, message) => {
      const { service, speciesRepository, audit, existing } = build(isActive);

      const result = await service.execute('sp-1', isActive, 'u-vet');

      expect(result).toEqual({ message, species: existing });
      expect(speciesRepository.updateStatus).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    },
  );

  it('responde 404 si la especie no existe', async () => {
    const { service, speciesRepository, audit, tx } = build();
    tx.species.findUnique.mockResolvedValue(null);

    await expect(service.execute('sp-x', false, 'u-vet')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Especie no encontrada',
    });
    expect(speciesRepository.updateStatus).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});

describe('SpeciesController.changeStatus (HU-15)', () => {
  const species = { id: 'sp-1', name: 'Canino', isActive: false };

  function controller() {
    const changeStatus = { execute: vi.fn(async () => ({ message: 'Especie inactivada correctamente', species })) };
    const instance = new SpeciesController({} as never, {} as never, {} as never, {} as never, changeStatus as never);
    return { instance, changeStatus };
  }

  it('exige el permiso species:change-status', () => {
    const method = Object.getOwnPropertyDescriptor(SpeciesController.prototype, 'changeSpeciesStatus')?.value;

    expect(Reflect.getMetadata(PERMISSIONS_METADATA, method as object)).toEqual(['species:change-status']);
  });

  it('delega con el usuario autenticado y responde con la especie y el mensaje', async () => {
    const { instance, changeStatus } = controller();

    const result = await instance.changeSpeciesStatus('sp-1', { isActive: false }, { user: { id: 'u-vet' } } as never);

    expect(changeStatus.execute).toHaveBeenCalledWith('sp-1', false, 'u-vet');
    expect(result).toMatchObject({ success: true, message: 'Especie inactivada correctamente', data: species });
  });

  it('rechaza la petición sin usuario autenticado', async () => {
    const { instance, changeStatus } = controller();

    await expect(instance.changeSpeciesStatus('sp-1', { isActive: true }, {} as never)).rejects.toMatchObject({ statusCode: 401 });
    expect(changeStatus.execute).not.toHaveBeenCalled();
  });
});
