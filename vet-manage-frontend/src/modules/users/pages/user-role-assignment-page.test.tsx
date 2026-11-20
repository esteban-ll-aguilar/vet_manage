import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../../auth/auth-context';
import { RequirePermission } from '../../auth/components/require-permission';
import { ApiError } from '../../../infrastructure/api/http-client';
import { usersApi } from '../services/users-api';
import type { UserRoleAssignment } from '../types';
import { UserRoleAssignmentPage } from './user-role-assignment-page';

vi.mock('../services/users-api', () => ({
  usersApi: {
    getRoleAssignment: vi.fn(),
    updateRoleAssignment: vi.fn(),
  },
}));

const toast = { showToast: vi.fn(), dismissToast: vi.fn() };
vi.mock('../../../common/components/toast-context', () => ({
  useToast: () => toast,
}));

function assignment(): UserRoleAssignment {
  return {
    user: { id: 'u1', status: 'ACTIVE', fullName: 'Carlos Pérez' },
    currentRoles: [{ name: 'receptionist', displayName: 'Recepcionista' }],
    availableRoles: [
      { name: 'cashier', displayName: 'Cajero' },
      { name: 'veterinarian', displayName: 'Veterinario' },
    ],
  };
}

function renderPage(overrides: Partial<AuthContextValue> = {}, initial = '/users/u1/roles') {
  const auth: AuthContextValue = {
    status: 'authenticated',
    session: null,
    login: vi.fn(async () => ({ mustChangePassword: false, user: { id: 'admin', firstName: 'Ana', lastName: 'Admin', email: 'admin@example.test', roles: [], permissions: [] } })),
    logout: vi.fn(async () => undefined),
    hasPermission: () => true,
    ...overrides,
  };

  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="/users/:id/roles" element={<RequirePermission permission="users:assign-roles"><UserRoleAssignmentPage /></RequirePermission>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('UserRoleAssignmentPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usersApi.getRoleAssignment).mockResolvedValue(assignment());
  });

  it('muestra roles actuales y disponibles sin repetir los asignados', async () => {
    renderPage();

    await screen.findByText('Carlos Pérez');
    expect(screen.getByLabelText('Quitar rol Recepcionista')).toBeChecked();
    expect(screen.queryByLabelText('Asignar rol Recepcionista')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Asignar rol Cajero')).toBeInTheDocument();
  });

  it('asigna un rol adicional y confirma el cambio', async () => {
    vi.mocked(usersApi.updateRoleAssignment).mockResolvedValue({
      ...assignment(),
      currentRoles: [
        { name: 'receptionist', displayName: 'Recepcionista' },
        { name: 'cashier', displayName: 'Cajero' },
      ],
      availableRoles: [{ name: 'veterinarian', displayName: 'Veterinario' }],
    });
    renderPage();
    await screen.findByText('Carlos Pérez');

    await userEvent.click(screen.getByLabelText('Asignar rol Cajero'));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(usersApi.updateRoleAssignment).toHaveBeenCalledWith('u1', expect.arrayContaining(['receptionist', 'cashier']));
    });
    expect(toast.showToast).toHaveBeenCalledWith('Roles actualizados correctamente', 'success');
  });

  it('quita un rol y permite cambiar de función', async () => {
    vi.mocked(usersApi.getRoleAssignment).mockResolvedValue({
      ...assignment(),
      currentRoles: [
        { name: 'receptionist', displayName: 'Recepcionista' },
        { name: 'cashier', displayName: 'Cajero' },
      ],
      availableRoles: [{ name: 'veterinarian', displayName: 'Veterinario' }],
    });
    vi.mocked(usersApi.updateRoleAssignment).mockResolvedValue({
      ...assignment(),
      currentRoles: [{ name: 'receptionist', displayName: 'Recepcionista' }],
      availableRoles: [
        { name: 'cashier', displayName: 'Cajero' },
        { name: 'veterinarian', displayName: 'Veterinario' },
      ],
    });
    renderPage();
    await screen.findByText('Carlos Pérez');

    await userEvent.click(screen.getByLabelText('Quitar rol Cajero'));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(usersApi.updateRoleAssignment).toHaveBeenCalledWith('u1', ['receptionist']);
    });
  });

  it('impide guardar sin roles y muestra el mensaje de HU-54', async () => {
    renderPage();
    await screen.findByText('Carlos Pérez');

    await userEvent.click(screen.getByLabelText('Quitar rol Recepcionista'));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(usersApi.updateRoleAssignment).not.toHaveBeenCalled();
    expect(toast.showToast).toHaveBeenCalledWith('El usuario debe tener al menos un rol', 'error');
  });

  it('muestra los mensajes de rechazo del backend y refresca la asignación', async () => {
    vi.mocked(usersApi.updateRoleAssignment).mockRejectedValue(new ApiError('Debe existir al menos un Administrador activo', 400));
    renderPage();
    await screen.findByText('Carlos Pérez');

    await userEvent.click(screen.getByLabelText('Asignar rol Cajero'));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(toast.showToast).toHaveBeenCalledWith('Debe existir al menos un Administrador activo', 'error');
    });
    expect(usersApi.getRoleAssignment).toHaveBeenCalledTimes(2);
  });

  it('deniega el acceso a usuarios sin users:assign-roles', () => {
    renderPage({ hasPermission: () => false });

    expect(screen.getByText('No tiene permisos para realizar esta acción')).toBeInTheDocument();
    expect(screen.queryByText('Gestionar roles')).not.toBeInTheDocument();
    expect(usersApi.getRoleAssignment).not.toHaveBeenCalled();
  });
});
