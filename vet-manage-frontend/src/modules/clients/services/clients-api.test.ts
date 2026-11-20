import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getJson } from '../../../infrastructure/api/http-client';
import type { ClientPage } from '../types';
import { clientsApi } from './clients-api';

vi.mock('../../../infrastructure/api/http-client', () => ({
  getJson: vi.fn(),
  postJson: vi.fn(),
}));

const emptyPage: ClientPage = { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };

describe('clientsApi.list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getJson).mockResolvedValue(emptyPage);
  });

  it('envía búsqueda, estado y paginación como parámetros de consulta', async () => {
    await clientsApi.list({ search: '  josé  ', status: 'ACTIVE', page: 2, pageSize: 10 });

    expect(getJson).toHaveBeenCalledWith('/clients?search=jos%C3%A9&status=ACTIVE&page=2&pageSize=10');
  });

  it('omite parámetros vacíos y permite consultar sin filtros', async () => {
    await clientsApi.list({ search: '   ', page: 1, pageSize: 20 });
    await clientsApi.list();

    expect(getJson).toHaveBeenNthCalledWith(1, '/clients?page=1&pageSize=20');
    expect(getJson).toHaveBeenNthCalledWith(2, '/clients');
  });
});

describe('clientsApi.pets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('consulta y desenvuelve las mascotas vinculadas al cliente', async () => {
    const pets = [{
      id: 'pet1',
      code: 'PAC-000001',
      name: 'Firulais',
      species: 'Canino',
      breed: 'Labrador',
      status: 'ACTIVE' as const,
    }];
    vi.mocked(getJson).mockResolvedValue(pets);

    await expect(clientsApi.pets('c1')).resolves.toEqual(pets);
    expect(getJson).toHaveBeenCalledWith('/clients/c1/pets');
  });
});
