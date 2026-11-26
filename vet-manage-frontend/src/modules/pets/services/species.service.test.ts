import { beforeEach, describe, expect, it, vi } from 'vitest';
import { patchJson } from '../../../infrastructure/api/http-client';
import { speciesApi } from './species.service';

vi.mock('../../../infrastructure/api/http-client', () => ({
  getJson: vi.fn(),
  patchJson: vi.fn(),
  postJson: vi.fn(),
}));

describe('speciesApi.changeStatus (HU-15)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([true, false])('envía PATCH al endpoint de estado con isActive=%s', async (isActive) => {
    const species = { id: 'sp-1', name: 'Canino', isActive };
    vi.mocked(patchJson).mockResolvedValue(species);

    const result = await speciesApi.changeStatus('sp-1', isActive);

    expect(patchJson).toHaveBeenCalledWith('/pets/species/sp-1/status', { isActive });
    expect(result).toEqual(species);
  });
});
