import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, Link, Outlet, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastContext } from '../../../common/components/toast-context';
import type { AuthContextValue } from '../../auth/auth-context';
import { AuthContext } from '../../auth/auth-context';
import { RequirePermission } from '../../auth/components/require-permission';
import { rolesApi } from '../services/roles-api';
import type { ManagedRole, RolePermissionsCatalog } from '../types';
import { RolePermissionsPage } from './role-permissions-page';

vi.mock('../services/roles-api', () => ({
  rolesApi: {
    permissionCatalog: vi.fn(),
    updatePermissions: vi.fn(),
  },
}));

const toast = {
  showToast: vi.fn(),
  dismissToast: vi.fn(),
  confirm: vi.fn(async () => true),
};

const administrator: ManagedRole = {
  id: 'role-admin',
  name: 'administrator',
  displayName: 'Administrador',
  category: 'STAFF',
  permissionKeys: [
    'roles:manage-permissions',
    'users:create',
    'users:read',
    'users:update',
    'users:assign-roles',
    'users:change-status',
    'users:deactivate',
  ],
};

const receptionist: ManagedRole = {
  id: 'role-receptionist',
  name: 'receptionist',
  displayName: 'Recepcionista',
  category: 'STAFF',
  permissionKeys: ['clients:read'],
};

const cashier: ManagedRole = {
  id: 'role-cashier',
  name: 'cashier',
  displayName: 'Cajero',
  category: 'STAFF',
  permissionKeys: ['medical-history:read'],
};

const catalog: RolePermissionsCatalog = {
  roles: [administrator, cashier, receptionist],
  protectedPermissionKeys: [
    'roles:manage-permissions',
    'users:create',
    'users:read',
    'users:update',
    'users:assign-roles',
    'users:change-status',
    'users:deactivate',
  ],
  permissions: [
    { key: 'clients:create', module: 'clients', action: 'create', displayName: 'Registrar clientes', description: '' },
    { key: 'clients:read', module: 'clients', action: 'read', displayName: 'Consultar clientes', description: '' },
    { key: 'medical-history:read', module: 'medical-history', action: 'read', displayName: 'Ver historial clínico', description: '' },
    { key: 'roles:manage-permissions', module: 'roles', action: 'manage-permissions', displayName: 'Gestionar permisos por rol', description: '' },
    { key: 'users:deactivate', module: 'users', action: 'deactivate', displayName: 'Dar de baja usuarios', description: '' },
    { key: 'users:read', module: 'users', action: 'read', displayName: 'Consultar usuarios', description: '' },
  ],
};

function renderPage(hasPermission = true) {
  const auth: AuthContextValue = {
    status: 'authenticated',
    session: null,
    login: vi.fn(async () => {
      throw new Error('not used');
    }),
    logout: vi.fn(async () => undefined),
    hasPermission: (permission) => hasPermission && permission === 'roles:manage-permissions',
  };
  const router = createMemoryRouter([
    {
      path: '/',
      element: (
        <>
          <Link to="/outside">Salir de pantalla</Link>
          <Outlet />
        </>
      ),
      children: [
        { index: true, element: <p>Inicio</p> },
        {
          path: 'roles/permissions',
          element: (
            <RequirePermission permission="roles:manage-permissions">
              <RolePermissionsPage />
            </RequirePermission>
          ),
        },
        { path: 'outside', element: <p>Pantalla externa</p> },
      ],
    },
  ], { initialEntries: ['/roles/permissions'] });

  return render(
    <AuthContext.Provider value={auth}>
      <ToastContext.Provider value={toast}>
        <RouterProvider router={router} />
      </ToastContext.Provider>
    </AuthContext.Provider>,
  );
}

describe('RolePermissionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rolesApi.permissionCatalog).mockResolvedValue(catalog);
  });

  it('permite asignar un permiso a un rol y guardar el cambio', async () => {
    vi.mocked(rolesApi.updatePermissions).mockResolvedValue({
      ...receptionist,
      permissionKeys: ['clients:create', 'clients:read'],
    });
    renderPage();
    await screen.findByRole('heading', { name: 'Gestionar permisos por rol' });

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Seleccionar rol' }), receptionist.id);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Registrar clientes' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(rolesApi.updatePermissions).toHaveBeenCalledWith(receptionist.id, ['clients:create', 'clients:read']);
    });
    expect(toast.showToast).toHaveBeenCalledWith('Permisos del rol actualizados correctamente', 'success');
  });

  it('permite retirar un permiso y guardarlo', async () => {
    vi.mocked(rolesApi.updatePermissions).mockResolvedValue({ ...cashier, permissionKeys: [] });
    renderPage();
    await screen.findByRole('heading', { name: 'Gestionar permisos por rol' });

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Seleccionar rol' }), cashier.id);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Ver historial clínico' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(rolesApi.updatePermissions).toHaveBeenCalledWith(cashier.id, []));
  });

  it('impide retirar permisos protegidos del Administrador y muestra el mensaje solicitado', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Gestionar permisos por rol' });

    const permission = screen.getByRole('checkbox', { name: 'Gestionar permisos por rol' });
    expect(permission).toBeChecked();
    await userEvent.click(permission);

    expect(permission).toBeChecked();
    const userManagementPermission = screen.getByRole('checkbox', { name: 'Dar de baja usuarios' });
    await userEvent.click(userManagementPermission);
    expect(userManagementPermission).toBeChecked();
    expect(toast.showToast).toHaveBeenCalledWith(
      'No se puede retirar este permiso al rol Administrador',
      'error',
    );
    expect(rolesApi.updatePermissions).not.toHaveBeenCalled();
  });

  it('pregunta antes de salir con cambios pendientes y descarta sin guardar si confirma', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Gestionar permisos por rol' });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Seleccionar rol' }), receptionist.id);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Registrar clientes' }));
    await userEvent.click(screen.getByRole('link', { name: 'Salir de pantalla' }));

    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('Tiene cambios sin guardar. ¿Desea salir?')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Permanecer' }));
    expect(screen.getByRole('heading', { name: 'Gestionar permisos por rol' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: 'Salir de pantalla' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Salir sin guardar' }));

    expect(await screen.findByText('Pantalla externa')).toBeInTheDocument();
    expect(rolesApi.updatePermissions).not.toHaveBeenCalled();
  });

  it('permite salir con la flecha de regreso cuando no hay cambios y pide confirmación si hay pendientes', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Gestionar permisos por rol' });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Seleccionar rol' }), receptionist.id);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Registrar clientes' }));
    await userEvent.click(screen.getByRole('link', { name: '← Salir' }));

    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('Tiene cambios sin guardar. ¿Desea salir?')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Permanecer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Descartar cambios' }));

    await userEvent.click(screen.getByRole('link', { name: '← Salir' }));
    expect(await screen.findByText('Inicio')).toBeInTheDocument();
    expect(rolesApi.updatePermissions).not.toHaveBeenCalled();
  });

  it('deniega acceso directo a usuarios sin permiso y no consulta la API', () => {
    renderPage(false);

    expect(screen.getByText('No tiene permisos para realizar esta acción')).toBeInTheDocument();
    expect(rolesApi.permissionCatalog).not.toHaveBeenCalled();
  });
});
