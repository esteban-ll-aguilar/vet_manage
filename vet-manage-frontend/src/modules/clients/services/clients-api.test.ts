import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getJson } from '../../../infrastructure/api/http-client';
import type { ClientPage } from '../types';
import { clientsApi } from './clients-api';

vi.mock('../../../infrastructure/api/http-client', () => ({
  getJson: vi.fn(),
  patchJson: vi.fn(),
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

describe('clientsApi.inactivate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('envía PATCH al endpoint de inactivación del cliente', async () => {
    const { patchJson } = await import('../../../infrastructure/api/http-client');
    vi.mocked(patchJson).mockResolvedValue({ id: 'c1', status: 'INACTIVE' });

    const result = await clientsApi.inactivate('c1');

    expect(patchJson).toHaveBeenCalledWith('/clients/c1/inactivate', {});
    expect(result).toEqual({ id: 'c1', status: 'INACTIVE' });
  });
});

describe('clientsApi.activate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('envía PATCH al endpoint de activación del cliente (HU-05)', async () => {
    const { patchJson } = await import('../../../infrastructure/api/http-client');
    vi.mocked(patchJson).mockResolvedValue({ id: 'c1', status: 'ACTIVE' });

    const result = await clientsApi.activate('c1');

    expect(patchJson).toHaveBeenCalledWith('/clients/c1/activate', {});
    expect(result).toEqual({ id: 'c1', status: 'ACTIVE' });
  });
});

describe('clientsApi.update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('envía PATCH con los datos editables del cliente', async () => {
    const { patchJson } = await import('../../../infrastructure/api/http-client');
    const input = { firstName: 'Carlos', lastName: 'Pérez', email: 'cperez@correo.com', phone: '0992222222', address: '' };
    vi.mocked(patchJson).mockResolvedValue({ id: 'c1', ...input, identification: '1710034065', address: null, status: 'ACTIVE' });

    const result = await clientsApi.update('c1', input);

    expect(patchJson).toHaveBeenCalledWith('/clients/c1', input);
    expect(result).toMatchObject({ id: 'c1', phone: '0992222222' });
  });
});

describe('clientsApi.deactivate (HU-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('envía PATCH al endpoint de baja con el motivo', async () => {
    const { patchJson } = await import('../../../infrastructure/api/http-client');
    const deactivated = { id: 'c1', status: 'DEACTIVATED', deactivatedAt: '2026-11-24T15:00:00.000Z', deactivationReason: 'Se mudó' };
    vi.mocked(patchJson).mockResolvedValue(deactivated);

    const result = await clientsApi.deactivate('c1', 'Se mudó');

    expect(patchJson).toHaveBeenCalledWith('/clients/c1/deactivate', { reason: 'Se mudó' });
    expect(result).toEqual(deactivated);
  });
});
