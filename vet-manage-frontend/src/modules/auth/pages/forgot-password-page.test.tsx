import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../infrastructure/api/http-client';
import { authApi } from '../services/auth-api';
import { ForgotPasswordPage } from './forgot-password-page';

vi.mock('../services/auth-api', () => ({
  authApi: { requestPasswordReset: vi.fn() },
}));

function renderPage(state?: { email?: string }) {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/forgot-password', state }]}>
      <Routes>
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/login" element={<div>Pantalla de inicio de sesión</div>} />
      </Routes>
    </MemoryRouter>,
  );
  return { email: screen.getByLabelText('Correo electrónico'), send: screen.getByRole('button', { name: 'Enviar enlace' }) };
}

describe('ForgotPasswordPage (HU-58)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authApi.requestPasswordReset).mockResolvedValue(null);
  });

  // Positivos
  it('envía la solicitud y muestra siempre el mensaje uniforme, sin permitir repetirla', async () => {
    const { email, send } = renderPage();
    await userEvent.type(email, '  ana@correo.com ');
    await userEvent.click(send);

    expect(authApi.requestPasswordReset).toHaveBeenCalledWith('ana@correo.com');
    expect(await screen.findByRole('status')).toHaveTextContent('Si el correo está registrado, recibirá un enlace');
    expect(send).toBeDisabled();
  });

  it('conserva el correo escrito en la pantalla de inicio de sesión', () => {
    const { email } = renderPage({ email: 'ana@correo.com' });

    expect(email).toHaveValue('ana@correo.com');
  });

  it('ofrece volver a la pantalla de inicio de sesión', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('link', { name: 'Volver a iniciar sesión' }));

    expect(screen.getByText('Pantalla de inicio de sesión')).toBeInTheDocument();
  });

  // Negativos
  it.each([['vacío', ''], ['sin dominio completo', 'ana@correo'], ['sin arroba', 'ana.correo.com']])(
    'con un correo %s no llama a la API y muestra el error bajo el campo',
    async (_, value) => {
      const { email, send } = renderPage();
      if (value) await userEvent.type(email, value);
      await userEvent.click(send);

      expect(authApi.requestPasswordReset).not.toHaveBeenCalled();
      expect(screen.getByText('Ingrese un correo electrónico válido')).toBeInTheDocument();
      expect(email).toHaveAttribute('aria-invalid', 'true');
    },
  );

  it('muestra el mensaje de la API si rechaza la solicitud y permite reintentar', async () => {
    vi.mocked(authApi.requestPasswordReset).mockRejectedValueOnce(new ApiError('Ingrese un correo electrónico válido', 400));
    const { email, send } = renderPage();
    await userEvent.type(email, 'ana@correo.com');
    await userEvent.click(send);

    expect(await screen.findByRole('alert')).toHaveTextContent('Ingrese un correo electrónico válido');
    await waitFor(() => expect(send).toBeEnabled());
  });

  it('informa si no hay conexión con el servidor', async () => {
    vi.mocked(authApi.requestPasswordReset).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { email, send } = renderPage();
    await userEvent.type(email, 'ana@correo.com');
    await userEvent.click(send);

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor');
  });
});
