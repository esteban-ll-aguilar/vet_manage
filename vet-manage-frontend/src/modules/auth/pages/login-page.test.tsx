import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../auth-context';
import { LoginPage } from './login-page';

const auth: AuthContextValue = {
  status: 'anonymous',
  session: null,
  login: vi.fn(),
  logout: vi.fn(),
  hasPermission: () => false,
};

function ForgotProbe() {
  const location = useLocation();
  return <div>Recuperar {JSON.stringify(location.state)}</div>;
}

function renderLogin(state?: unknown) {
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotProbe />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('LoginPage – recuperación de contraseña (HU-58)', () => {
  it('muestra el enlace «¿Olvidó su contraseña?» en lugar del aviso de contactar al administrador', () => {
    renderLogin();

    expect(screen.getByRole('link', { name: '¿Olvidó su contraseña?' })).toHaveAttribute('href', '/forgot-password');
    expect(screen.queryByText(/Comunícate con el administrador/)).not.toBeInTheDocument();
  });

  it('abre la recuperación conservando el correo escrito', async () => {
    renderLogin();
    await userEvent.type(screen.getByLabelText('Correo electrónico'), 'ana@correo.com');
    await userEvent.click(screen.getByRole('link', { name: '¿Olvidó su contraseña?' }));

    expect(screen.getByText(/Recuperar/)).toHaveTextContent('"email":"ana@correo.com"');
  });

  it('muestra el aviso de contraseña actualizada al volver del restablecimiento', () => {
    renderLogin({ passwordReset: true });

    expect(screen.getByRole('status')).toHaveTextContent('Contraseña actualizada. Inicie sesión con su nueva contraseña');
  });

  it('no muestra el aviso en un ingreso normal', () => {
    renderLogin();

    expect(screen.queryByText(/Contraseña actualizada/)).not.toBeInTheDocument();
  });
});
