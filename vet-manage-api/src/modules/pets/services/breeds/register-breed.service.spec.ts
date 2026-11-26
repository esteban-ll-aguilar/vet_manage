import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RegisterBreedService } from './register-breed.service.js';
import type { BreedRepository } from '../../repositories/breed.repository.js';
import type { SpeciesRepository } from '../../repositories/species.repository.js';

const speciesId = '123e4567-e89b-12d3-a456-426614174000';
const ACTOR_ID = 'user-1';
const tx = { name: 'tx' };

describe('RegisterBreedService', () => {
  const findByNameInSpecies = vi.fn();
  const create = vi.fn();
  const findById = vi.fn();
  const audit = { record: vi.fn(async () => undefined) };
  const prisma = { $transaction: vi.fn(async (run: (client: unknown) => unknown) => run(tx)) };
  let service: RegisterBreedService;

  beforeEach(() => {
    vi.resetAllMocks();
    findById.mockResolvedValue({ id: speciesId, name: 'Canino', isActive: true });
    findByNameInSpecies.mockResolvedValue(null);
    create.mockImplementation(async (data) => ({ id: 'b1', isActive: true, ...data }));
    service = new RegisterBreedService(
      { findByNameInSpecies, create } as unknown as BreedRepository,
      { findById } as unknown as SpeciesRepository,
      prisma as never,
      audit as never,
    );
  });

  it('registers a breed trimming the name', async () => {
    const result = await service.execute({ name: '  Labrador ', speciesId, description: 'Grande' }, ACTOR_ID);

    expect(create).toHaveBeenCalledWith({ name: 'Labrador', speciesId, description: 'Grande' }, tx);
    expect(result).toMatchObject({ name: 'Labrador', speciesId });
  });

  it('registers a breed without description', async () => {
    await service.execute({ name: 'Labrador', speciesId }, ACTOR_ID);

    expect(create).toHaveBeenCalledWith({ name: 'Labrador', speciesId, description: undefined }, tx);
  });

  it('rejects a blank name with 400', async () => {
    await expect(service.execute({ name: '   ', speciesId }, ACTOR_ID)).rejects.toMatchObject({ statusCode: 400 });
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects an unknown species with 404', async () => {
    findById.mockResolvedValue(null);

    await expect(service.execute({ name: 'Labrador', speciesId }, ACTOR_ID)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('rejects an inactive species with 409', async () => {
    findById.mockResolvedValue({ id: speciesId, name: 'Canino', isActive: false });

    await expect(service.execute({ name: 'Labrador', speciesId }, ACTOR_ID)).rejects.toMatchObject({ statusCode: 409 });
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate name in the same species with 409', async () => {
    findByNameInSpecies.mockResolvedValue({ id: 'x' });

    await expect(service.execute({ name: 'labrador', speciesId }, ACTOR_ID)).rejects.toMatchObject({ statusCode: 409 });
    expect(create).not.toHaveBeenCalled();
  });

  it('maps a unique constraint race to 409', async () => {
    create.mockRejectedValue({ code: 'P2002' });

    await expect(service.execute({ name: 'Labrador', speciesId }, ACTOR_ID)).rejects.toMatchObject({ statusCode: 409 });
  });

  describe('auditoría', () => {
    it('registra la acción en la misma transacción con el nombre de la raza y su especie', async () => {
      await service.execute({ name: ' Labrador ', speciesId }, ACTOR_ID);

      expect(audit.record).toHaveBeenCalledTimes(1);
      expect(audit.record).toHaveBeenCalledWith(tx, {
        actorId: ACTOR_ID,
        action: 'Registrar',
        module: 'Razas',
        affectedRecord: 'Labrador (Canino)',
      });
    });

    it('no registra nada cuando la raza se rechaza', async () => {
      findByNameInSpecies.mockResolvedValue({ id: 'b0' });

      await expect(service.execute({ name: 'Labrador', speciesId }, ACTOR_ID)).rejects.toMatchObject({ statusCode: 409 });

      expect(audit.record).not.toHaveBeenCalled();
    });

    it('falla el registro si no se puede guardar la auditoría', async () => {
      audit.record.mockRejectedValue(new Error('fallo de auditoría'));

      await expect(service.execute({ name: 'Labrador', speciesId }, ACTOR_ID)).rejects.toThrow('fallo de auditoría');
    });
  });
});
