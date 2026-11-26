import { describe, expect, it, vi } from 'vitest';
import { ListActiveBreedsService } from './list-active-breeds.service.js';
import type { BreedRepository } from '../../repositories/breed.repository.js';

describe('ListActiveBreedsService', () => {
  it('returns the active breeds of the given species', async () => {
    const active = [{ id: 'b1', name: 'Labrador' }, { id: 'b2', name: 'Poodle' }];
    const findActiveBySpecies = vi.fn().mockResolvedValue(active);
    const service = new ListActiveBreedsService({ findActiveBySpecies } as unknown as BreedRepository);

    await expect(service.execute('species-1')).resolves.toEqual(active);
    expect(findActiveBySpecies).toHaveBeenCalledWith('species-1');
  });

  it('returns an empty list when the species has no active breeds', async () => {
    const service = new ListActiveBreedsService({
      findActiveBySpecies: vi.fn().mockResolvedValue([]),
    } as unknown as BreedRepository);

    await expect(service.execute('species-1')).resolves.toEqual([]);
  });
});
