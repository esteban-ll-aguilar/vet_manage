import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiException } from '../../../../common/errors/api-exception.js';
import { AUDIT_ACTIONS, AUDIT_MODULES } from '../../../audit/audit.catalog.js';
import { PERMISSIONS_METADATA } from '../../../identity/decorators/require-permissions.decorator.js';
import { BreedController } from '../../routes/breed.controller.js';
import { UpdateBreedService } from './update-breed.service.js';

describe('UpdateBreedService', () => {
  const txMock = {};
  const breedRepository = {
    findByIdWithSpecies: vi.fn(),
    findByNameInSpecies: vi.fn(),
    update: vi.fn(),
  };
  const speciesRepository = {
    findById: vi.fn(),
  };
  const prisma = {
    $transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb(txMock)),
  };
  const audit = {
    record: vi.fn(),
  };

  let service: UpdateBreedService;

  const existingBreed = {
    id: 'br-1',
    name: 'Labrador',
    description: 'Perro amigable',
    isActive: true,
    speciesId: 'sp-1',
    species: { id: 'sp-1', name: 'Canino' },
    createdAt: new Date('2026-11-18T00:00:00.000Z'),
    updatedAt: new Date('2026-11-18T00:00:00.000Z'),
  };

  const activeSpecies = {
    id: 'sp-1',
    name: 'Canino',
    description: null,
    isActive: true,
    createdAt: new Date('2026-11-18T00:00:00.000Z'),
    updatedAt: new Date('2026-11-18T00:00:00.000Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UpdateBreedService(
      breedRepository as never,
      speciesRepository as never,
      prisma as never,
      audit as never,
    );
  });

  it('actualiza nombre, especie y descripción y registra auditoría atómica', async () => {
    const newSpecies = { ...activeSpecies, id: 'sp-2', name: 'Felino' };
    const updated = {
      ...existingBreed,
      name: 'Siamés',
      speciesId: 'sp-2',
      species: { id: 'sp-2', name: 'Felino' },
      description: 'Gato elegante',
    };
    breedRepository.findByIdWithSpecies.mockResolvedValue(existingBreed);
    speciesRepository.findById.mockResolvedValue(newSpecies);
    breedRepository.findByNameInSpecies.mockResolvedValue(null);
    breedRepository.update.mockResolvedValue(updated);

    const result = await service.execute(
      'br-1',
      { name: '  Siamés  ', speciesId: 'sp-2', description: '  Gato elegante  ' },
      'actor-1',
    );

    expect(result).toEqual(updated);
    expect(breedRepository.update).toHaveBeenCalledWith(
      'br-1',
      { name: 'Siamés', speciesId: 'sp-2', description: 'Gato elegante' },
      txMock,
    );
    expect(audit.record).toHaveBeenCalledWith(txMock, {
      actorId: 'actor-1',
      action: AUDIT_ACTIONS.update,
      module: AUDIT_MODULES.breeds,
      affectedRecord: 'Siamés (Felino)',
      previousValue: { name: 'Labrador', species: 'Canino', description: 'Perro amigable' },
      newValue: { name: 'Siamés', species: 'Felino', description: 'Gato elegante' },
    });
  });

  it('permite actualizar limpiando la descripción opcional a null', async () => {
    const updated = { ...existingBreed, description: null };
    breedRepository.findByIdWithSpecies.mockResolvedValue(existingBreed);
    speciesRepository.findById.mockResolvedValue(activeSpecies);
    breedRepository.findByNameInSpecies.mockResolvedValue(existingBreed);
    breedRepository.update.mockResolvedValue(updated);

    const result = await service.execute('br-1', { name: 'Labrador', speciesId: 'sp-1', description: '   ' }, 'actor-1');

    expect(result.description).toBeNull();
    expect(breedRepository.update).toHaveBeenCalledWith(
      'br-1',
      { name: 'Labrador', speciesId: 'sp-1', description: null },
      txMock,
    );
  });

  it('rechaza con 400 cuando el nombre está vacío', async () => {
    await expect(
      service.execute('br-1', { name: '   ', speciesId: 'sp-1' }, 'actor-1'),
    ).rejects.toThrow(ApiException);

    expect(breedRepository.findByIdWithSpecies).not.toHaveBeenCalled();
  });

  it('rechaza con 404 cuando la raza no existe', async () => {
    breedRepository.findByIdWithSpecies.mockResolvedValue(null);

    await expect(
      service.execute('missing-id', { name: 'Labrador', speciesId: 'sp-1' }, 'actor-1'),
    ).rejects.toMatchObject({ statusCode: 404, message: 'Raza no encontrada' });
  });

  it('rechaza con 404 cuando la especie seleccionada no existe', async () => {
    breedRepository.findByIdWithSpecies.mockResolvedValue(existingBreed);
    speciesRepository.findById.mockResolvedValue(null);

    await expect(
      service.execute('br-1', { name: 'Labrador', speciesId: 'sp-missing' }, 'actor-1'),
    ).rejects.toMatchObject({ statusCode: 404, message: 'La especie seleccionada no existe' });
  });

  it('rechaza con 409 al reasignar a una especie inactiva', async () => {
    breedRepository.findByIdWithSpecies.mockResolvedValue(existingBreed);
    speciesRepository.findById.mockResolvedValue({ ...activeSpecies, id: 'sp-2', name: 'Equino', isActive: false });

    await expect(
      service.execute('br-1', { name: 'Labrador', speciesId: 'sp-2' }, 'actor-1'),
    ).rejects.toMatchObject({ statusCode: 409, message: 'La especie seleccionada está inactiva' });
  });

  it('rechaza con 409 cuando ya existe otra raza con el mismo nombre en la especie destino', async () => {
    breedRepository.findByIdWithSpecies.mockResolvedValue(existingBreed);
    speciesRepository.findById.mockResolvedValue(activeSpecies);
    breedRepository.findByNameInSpecies.mockResolvedValue({ ...existingBreed, id: 'br-2', name: 'Poodle' });

    await expect(
      service.execute('br-1', { name: 'poodle', speciesId: 'sp-1' }, 'actor-1'),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('retorna sin duplicar auditoría cuando no hubo cambios reales', async () => {
    breedRepository.findByIdWithSpecies.mockResolvedValue(existingBreed);
    speciesRepository.findById.mockResolvedValue(activeSpecies);
    breedRepository.findByNameInSpecies.mockResolvedValue(existingBreed);

    const result = await service.execute(
      'br-1',
      { name: 'Labrador', speciesId: 'sp-1', description: 'Perro amigable' },
      'actor-1',
    );

    expect(result).toEqual(existingBreed);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('exige el permiso breeds:update en BreedController.updateBreed', () => {
    const handler = Object.getOwnPropertyDescriptor(BreedController.prototype, 'updateBreed')?.value;
    const permissions = Reflect.getMetadata(PERMISSIONS_METADATA, handler);
    expect(permissions).toEqual(['breeds:update']);
  });
});
