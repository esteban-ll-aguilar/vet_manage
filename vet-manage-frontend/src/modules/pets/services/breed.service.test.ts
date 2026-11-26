import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getJson } from '../../../infrastructure/api/http-client';
import { breedApi } from './breed.service';

vi.mock('../../../infrastructure/api/http-client', () => ({
  getJson: vi.fn(),
  postJson: vi.fn(),
  patchJson: vi.fn(),
}));

describe('breedApi – consulta de razas (HU-20)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getJson).mockResolvedValue([]);
  });

  it('sin filtros consulta /pets/breeds', async () => {
    await breedApi.listBreeds();
    expect(getJson).toHaveBeenCalledWith('/pets/breeds');
  });

  it('envía la búsqueda recortada y la especie', async () => {
    await breedApi.listBreeds({ search: '  siamés ', speciesId: 'sp-2' });
    expect(getJson).toHaveBeenCalledWith('/pets/breeds?search=siam%C3%A9s&speciesId=sp-2');
  });

  it('omite una búsqueda vacía o solo con espacios', async () => {
    await breedApi.listBreeds({ search: '   ' });
    expect(getJson).toHaveBeenCalledWith('/pets/breeds');
  });

  it('consulta el detalle de una raza', async () => {
    await breedApi.getBreed('br-1');
    expect(getJson).toHaveBeenCalledWith('/pets/breeds/br-1');
  });
});
