import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../../common/components/toast';
import { AuthContext, type AuthContextValue } from '../auth-context';
import { RequireAuth } from '../components/require-auth';
import { authApi } from '../services/auth-api';
import { ChangePasswordPage } from './change-password-page';

vi.mock('../services/auth-api', () => ({
  authApi: {
    changePassword: vi.fn(),
  },
}));

function renderWithAuth(initialPath = '/change-password', mustChangePassword = false) {
  const clearMustChangePassword = vi.fn();
  const auth: AuthContextValue = {
    status: 'authenticated',
    session: {
      mustChangePassword,
      user: {
        id: 'u-1',
        firstName: 'Luis',
        lastName: 'Torres',
        email: 'luis@example.test',
        roles: [{ name: 'veterinarian', displayName: 'Veterinario' }],
        permissions: [],
      },
    },
    login: vi.fn(),
    logout: vi.fn(),
    hasPermission: () => true,
    clearMustChangePassword,
  };

  render(
    <ToastProvider>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route element={<RequireAuth />}>
              <Route path="/" element={<div>Inicio del sistema</div>} />
              <Route path="/clients" element={<div>Pantalla clientes</div>} />
              <Route path="/change-password" element={<ChangePasswordPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </ToastProvider>,
  );

  return { clearMustChangePassword };
}

describe('ChangePasswordPage & mandatory redirect (HU-59)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cambia la contraseña exitosamente y muestra el mensaje de confirmación', async () => {
    vi.mocked(authApi.changePassword).mockResolvedValue(null);
    const { clearMustChangePassword } = renderWithAuth('/change-password', true);

    await userEvent.type(screen.getByLabelText('Contraseña actual'), 'Temporal1');
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'Segura2026');
    await userEvent.type(screen.getByLabelText('Confirmar nueva contraseña'), 'Segura2026');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(authApi.changePassword).toHaveBeenCalledWith({
        currentPassword: 'Temporal1',
        newPassword: 'Segura2026',
        confirmPassword: 'Segura2026',
      });
    });
    expect(clearMustChangePassword).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Contraseña actualizada correctamente')).toBeInTheDocument();
  });

  it('muestra error del backend cuando la contraseña actual es incorrecta', async () => {
    vi.mocked(authApi.changePassword).mockRejectedValue(new Error('La contraseña actual no es correcta'));
    renderWithAuth();

    await userEvent.type(screen.getByLabelText('Contraseña actual'), 'MalaClave1');
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'Segura2026');
    await userEvent.type(screen.getByLabelText('Confirmar nueva contraseña'), 'Segura2026');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('La contraseña actual no es correcta');
  });

  it('rechaza en cliente una nueva contraseña que no cumple la política', async () => {
    renderWithAuth();

    await userEvent.type(screen.getByLabelText('Contraseña actual'), 'Actual123');
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'clave1');
    await userEvent.type(screen.getByLabelText('Confirmar nueva contraseña'), 'clave1');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número',
    );
    expect(authApi.changePassword).not.toHaveBeenCalled();
  });

  it('rechaza cuando la confirmación no coincide', async () => {
    renderWithAuth();

    await userEvent.type(screen.getByLabelText('Contraseña actual'), 'Actual123');
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'Segura2026');
    await userEvent.type(screen.getByLabelText('Confirmar nueva contraseña'), 'Distinta2026');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Las contraseñas no coinciden');
    expect(authApi.changePassword).not.toHaveBeenCalled();
  });

  it('rechaza cuando la nueva contraseña es igual a la actual', async () => {
    renderWithAuth();

    await userEvent.type(screen.getByLabelText('Contraseña actual'), 'Actual123');
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'Actual123');
    await userEvent.type(screen.getByLabelText('Confirmar nueva contraseña'), 'Actual123');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(screen.getByRole('alert')).toHaveTextContent('La nueva contraseña debe ser diferente a la actual');
    expect(authApi.changePassword).not.toHaveBeenCalled();
  });

  it('redirige obligatoriamente a /change-password si intenta abrir otra pantalla con mustChangePassword=true', () => {
    renderWithAuth('/clients', true);

    expect(screen.getByRole('heading', { name: 'Cambiar contraseña' })).toBeInTheDocument();
    expect(screen.getByText('Cambio obligatorio en el primer ingreso')).toBeInTheDocument();
    expect(screen.queryByText('Pantalla clientes')).not.toBeInTheDocument();
  });
});
