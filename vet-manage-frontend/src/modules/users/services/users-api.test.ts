import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getJson } from '../../../infrastructure/api/http-client';
import type { UserPage } from '../types';
import { usersApi } from './users-api';

vi.mock('../../../infrastructure/api/http-client', () => ({
  getJson: vi.fn(),
  postJson: vi.fn(),
  putJson: vi.fn(),
}));

const emptyPage: UserPage = { items: [], total: 0, page: 1, pageSize: 20 };

describe('usersApi.list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getJson).mockResolvedValue(emptyPage);
  });

  it('envía búsqueda, filtros y paginación como parámetros de consulta', async () => {
    await usersApi.list({
      q: 'Pérez',
      role: 'veterinarian',
      status: 'ACTIVE',
      page: 2,
      pageSize: 20,
    });

    expect(getJson).toHaveBeenCalledWith(
      '/users?q=P%C3%A9rez&role=veterinarian&status=ACTIVE&page=2&pageSize=20',
    );
  });

  it('omite los parámetros vacíos y conserva la paginación', async () => {
    await usersApi.list({ q: '   ', role: '', page: 1, pageSize: 20 });

    expect(getJson).toHaveBeenCalledWith('/users?page=1&pageSize=20');
  });

  it('permite consultar sin parámetros', async () => {
    await usersApi.list();

    expect(getJson).toHaveBeenCalledWith('/users');
  });
});

describe('usersApi role assignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('consulta la asignación de roles del usuario', async () => {
    const { getJson } = await import('../../../infrastructure/api/http-client');
    vi.mocked(getJson).mockResolvedValue({ user: { id: 'u1', status: 'ACTIVE', fullName: 'Ana Admin' }, currentRoles: [], availableRoles: [] });

    await usersApi.getRoleAssignment('u1');

    expect(getJson).toHaveBeenCalledWith('/users/u1/role-assignment');
  });

  it('guarda la asignación de roles con PUT', async () => {
    const { putJson } = await import('../../../infrastructure/api/http-client');
    vi.mocked(putJson).mockResolvedValue({ user: { id: 'u1', status: 'ACTIVE', fullName: 'Ana Admin' }, currentRoles: [], availableRoles: [] });

    await usersApi.updateRoleAssignment('u1', ['receptionist', 'cashier']);

    expect(putJson).toHaveBeenCalledWith('/users/u1/role-assignment', { roles: ['receptionist', 'cashier'] });
  });
});
