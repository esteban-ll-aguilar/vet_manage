import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS_METADATA } from '../../../identity/decorators/require-permissions.decorator.js';
import { SpeciesController } from '../../routes/species.controller.js';
import { UpdateSpeciesService } from './update-species.service.js';

function build() {
  const tx = {};
  const existing = {
    id: 'sp-1',
    name: 'Canino',
    description: 'Perros domésticos',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const speciesRepository = {
    findById: vi.fn().mockResolvedValue(existing),
    findByName: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockImplementation(async (id: string, data: { name: string; description: string | null }) => ({
      ...existing,
      id,
      name: data.name,
      description: data.description,
    })),
  };
  const prisma = {
    $transaction: vi.fn(async (run: (client: unknown) => Promise<unknown>) => run(tx)),
  };
  const audit = { record: vi.fn(async () => undefined) };
  const service = new UpdateSpeciesService(speciesRepository as never, prisma as never, audit as never);
  return { service, speciesRepository, prisma, audit, tx, existing };
}

describe('UpdateSpeciesService', () => {
  it('actualiza nombre y descripción y registra auditoría atómica', async () => {
    const { service, speciesRepository, audit, tx } = build();

    const result = await service.execute('sp-1', { name: '  Canino doméstico  ', description: '  Mascotas caninas  ' }, 'u-vet');

    expect(result.name).toBe('Canino doméstico');
    expect(result.description).toBe('Mascotas caninas');
    expect(speciesRepository.update).toHaveBeenCalledWith(
      'sp-1',
      { name: 'Canino doméstico', description: 'Mascotas caninas' },
      tx,
    );
    expect(audit.record).toHaveBeenCalledWith(tx, {
      actorId: 'u-vet',
      action: 'Actualizar',
      module: 'Especies',
      affectedRecord: 'Canino doméstico',
      previousValue: { name: 'Canino', description: 'Perros domésticos' },
      newValue: { name: 'Canino doméstico', description: 'Mascotas caninas' },
    });
  });

  it('permite actualizar dejando la descripción vacía (null)', async () => {
    const { service, speciesRepository, audit } = build();

    const result = await service.execute('sp-1', { name: 'Canino', description: '   ' }, 'u-vet');

    expect(result.description).toBeNull();
    expect(speciesRepository.update).toHaveBeenCalledWith('sp-1', { name: 'Canino', description: null }, expect.anything());
    expect(audit.record).toHaveBeenCalledTimes(1);
  });

  it('rechaza con 400 cuando el nombre está vacío', async () => {
    const { service, speciesRepository, audit } = build();

    await expect(service.execute('sp-1', { name: '   ', description: 'Test' }, 'u-vet')).rejects.toMatchObject({
      statusCode: 400,
      message: 'El nombre de la especie es obligatorio',
    });
    expect(speciesRepository.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('rechaza con 409 si otra especie ya tiene ese nombre', async () => {
    const { service, speciesRepository, audit } = build();
    speciesRepository.findByName.mockResolvedValue({ id: 'sp-2', name: 'Felino' });

    await expect(service.execute('sp-1', { name: 'Felino' }, 'u-vet')).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(speciesRepository.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('devuelve 404 si la especie no existe', async () => {
    const { service, speciesRepository, audit } = build();
    speciesRepository.findById.mockResolvedValue(null);

    await expect(service.execute('sp-missing', { name: 'Canino' }, 'u-vet')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Especie no encontrada',
    });
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('no actualiza ni duplica auditoría si los datos no cambiaron', async () => {
    const { service, speciesRepository, audit } = build();

    const result = await service.execute('sp-1', { name: 'Canino', description: 'Perros domésticos' }, 'u-vet');

    expect(result.name).toBe('Canino');
    expect(speciesRepository.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('exige el permiso species:update en SpeciesController.updateSpecies', () => {
    const method = Object.getOwnPropertyDescriptor(SpeciesController.prototype, 'updateSpecies')?.value;
    const permissions = Reflect.getMetadata(PERMISSIONS_METADATA, method as object);

    expect(permissions).toEqual(['species:update']);
  });
});
