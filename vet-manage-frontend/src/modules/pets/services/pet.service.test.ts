import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getJson } from '../../../infrastructure/api/http-client';
import { petApi } from './pet.service';

vi.mock('../../../infrastructure/api/http-client', () => ({
  getJson: vi.fn(),
  postJson: vi.fn(),
}));

describe('petApi.searchActiveClients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('conserva status, search y pageSize al consultar el listado de clientes', async () => {
    vi.mocked(getJson).mockResolvedValue({
      items: [{
        id: 'c1',
        identification: '0961447281',
        firstName: 'María',
        lastName: 'López',
        status: 'ACTIVE',
      }],
      total: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    });

    const clients = await petApi.searchActiveClients('  mar  ');

    expect(getJson).toHaveBeenCalledWith('/clients?status=ACTIVE&pageSize=10&search=mar');
    expect(clients).toEqual([{
      id: 'c1',
      identification: '0961447281',
      firstName: 'María',
      lastName: 'López',
    }]);
  });

  it('omite search cuando el término está vacío', async () => {
    vi.mocked(getJson).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 });

    await expect(petApi.searchActiveClients('   ')).resolves.toEqual([]);
    expect(getJson).toHaveBeenCalledWith('/clients?status=ACTIVE&pageSize=10');
  });
});
