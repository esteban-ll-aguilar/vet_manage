import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getJson } from '../../../infrastructure/api/http-client';
import type { UserPage } from '../types';
import { usersApi } from './users-api';

vi.mock('../../../infrastructure/api/http-client', () => ({
  getJson: vi.fn(),
  patchJson: vi.fn(),
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

describe('usersApi.changeStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('envía PATCH al endpoint de estado del usuario', async () => {
    const { patchJson } = await import('../../../infrastructure/api/http-client');
    vi.mocked(patchJson).mockResolvedValue({ id: 'u1', status: 'INACTIVE' });

    const result = await usersApi.changeStatus('u1', 'INACTIVE');

    expect(patchJson).toHaveBeenCalledWith('/users/u1/status', { status: 'INACTIVE' });
    expect(result).toEqual({ id: 'u1', status: 'INACTIVE' });
  });
});

describe('usersApi.get y update (HU-53)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('consulta el detalle del usuario', async () => {
    vi.mocked(getJson).mockResolvedValue({ id: 'u1', phone: '0991111111' });

    const user = await usersApi.get('u1');

    expect(getJson).toHaveBeenCalledWith('/users/u1');
    expect(user).toMatchObject({ id: 'u1', phone: '0991111111' });
  });

  it('envía PATCH con los datos editables, sin la cédula', async () => {
    const { patchJson } = await import('../../../infrastructure/api/http-client');
    const input = { firstName: 'Carlos', lastName: 'Pérez', email: 'cperez@correo.com', phone: '0992222222' };
    vi.mocked(patchJson).mockResolvedValue({ id: 'u1', ...input, noticeSent: null });

    const result = await usersApi.update('u1', input);

    expect(patchJson).toHaveBeenCalledWith('/users/u1', input);
    expect(result).toMatchObject({ id: 'u1', noticeSent: null });
  });
});
