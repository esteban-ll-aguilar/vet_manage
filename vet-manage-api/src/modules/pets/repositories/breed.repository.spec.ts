import { describe, expect, it, vi } from 'vitest';
import { BreedRepository } from './breed.repository.js';

function build() {
  const findMany = vi.fn(async () => []);
  const repository = new BreedRepository({ breed: { findMany } } as never);
  return { repository, findMany };
}

describe('BreedRepository.findByFilters (HU-20)', () => {
  it('sin filtros consulta todas las razas, activas e inactivas, por nombre', async () => {
    const { repository, findMany } = build();
    await repository.findByFilters({});
    expect(findMany).toHaveBeenCalledWith({
      where: {},
      include: { species: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
  });

  it('combina especie y variantes del nombre sin distinguir mayúsculas', async () => {
    const { repository, findMany } = build();
    await repository.findByFilters({ speciesId: 's1', nameVariants: ['siames', 'siamés'] });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        speciesId: 's1',
        OR: [
          { name: { contains: 'siames', mode: 'insensitive' } },
          { name: { contains: 'siamés', mode: 'insensitive' } },
        ],
      },
    }));
  });
});
