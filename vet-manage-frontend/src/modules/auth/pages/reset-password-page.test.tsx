import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../infrastructure/api/http-client';
import { authApi } from '../services/auth-api';
import { ResetPasswordPage } from './reset-password-page';

vi.mock('../services/auth-api', () => ({
  authApi: { validatePasswordReset: vi.fn(), confirmPasswordReset: vi.fn() },
}));

const POLICY = 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número';
const expired = () => new ApiError('El enlace ha expirado. Solicite uno nuevo', 410, { code: 'PASSWORD_RESET_LINK_EXPIRED' });
const invalid = () => new ApiError('El enlace no es válido. Solicite uno nuevo', 400, { code: 'PASSWORD_RESET_LINK_INVALID' });

function LoginProbe() {
  const location = useLocation();
  return <div>Inicio de sesión {JSON.stringify(location.state)}</div>;
}

function renderPage(path = '/reset-password?token=tok-123') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/forgot-password" element={<div>Pantalla de solicitud</div>} />
        <Route path="/login" element={<LoginProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function openForm() {
  renderPage();
  return {
    password: await screen.findByLabelText('Nueva contraseña'),
    confirm: screen.getByLabelText('Confirmar contraseña'),
    save: screen.getByRole('button', { name: 'Guardar' }),
  };
}

describe('ResetPasswordPage (HU-58)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authApi.validatePasswordReset).mockResolvedValue({ valid: true });
    vi.mocked(authApi.confirmPasswordReset).mockResolvedValue(null);
  });

  // Positivos
  it('valida el enlace al abrirlo y muestra el formulario', async () => {
    const { password, confirm, save } = await openForm();

    expect(authApi.validatePasswordReset).toHaveBeenCalledWith('tok-123');
    expect(password).toBeInTheDocument();
    expect(confirm).toBeInTheDocument();
    expect(save).toBeEnabled();
  });

  it('restablece la contraseña y vuelve al inicio de sesión con el aviso, sin abrir sesión', async () => {
    const { password, confirm, save } = await openForm();
    await userEvent.type(password, 'NuevaClave2026');
    await userEvent.type(confirm, 'NuevaClave2026');
    await userEvent.click(save);

    expect(authApi.confirmPasswordReset).toHaveBeenCalledWith({
      token: 'tok-123',
      newPassword: 'NuevaClave2026',
      confirmPassword: 'NuevaClave2026',
    });
    expect(await screen.findByText(/Inicio de sesión/)).toHaveTextContent('"passwordReset":true');
  });

  // Negativos: estado del enlace
  it('con un enlace vencido oculta el formulario y ofrece pedir otro', async () => {
    vi.mocked(authApi.validatePasswordReset).mockRejectedValueOnce(expired());
    renderPage();

    expect(await screen.findByText('El enlace ha expirado. Solicite uno nuevo')).toBeInTheDocument();
    expect(screen.queryByLabelText('Nueva contraseña')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Solicitar un nuevo enlace' }));
    expect(screen.getByText('Pantalla de solicitud')).toBeInTheDocument();
  });

  it('con un enlace usado o reemplazado muestra «no es válido» sin formulario', async () => {
    vi.mocked(authApi.validatePasswordReset).mockRejectedValueOnce(invalid());
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('El enlace no es válido. Solicite uno nuevo');
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
  });

  it('sin token en la dirección no llama a la API y muestra «no es válido»', () => {
    renderPage('/reset-password');

    expect(authApi.validatePasswordReset).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('El enlace no es válido. Solicite uno nuevo');
  });

  it('si el enlace vence mientras se llena el formulario, muestra «ha expirado»', async () => {
    vi.mocked(authApi.confirmPasswordReset).mockRejectedValueOnce(expired());
    const { password, confirm, save } = await openForm();
    await userEvent.type(password, 'NuevaClave2026');
    await userEvent.type(confirm, 'NuevaClave2026');
    await userEvent.click(save);

    expect(await screen.findByText('El enlace ha expirado. Solicite uno nuevo')).toBeInTheDocument();
    expect(screen.queryByLabelText('Nueva contraseña')).not.toBeInTheDocument();
  });

  // Negativos: validación en el cliente
  it('con una contraseña débil no envía y muestra la política', async () => {
    const { password, confirm, save } = await openForm();
    await userEvent.type(password, 'abc123');
    await userEvent.type(confirm, 'abc123');
    await userEvent.click(save);

    expect(authApi.confirmPasswordReset).not.toHaveBeenCalled();
    expect(screen.getByText(POLICY)).toBeInTheDocument();
    expect(password).toHaveAttribute('aria-invalid', 'true');
  });

  it('con una confirmación distinta no envía y muestra «Las contraseñas no coinciden»', async () => {
    const { password, confirm, save } = await openForm();
    await userEvent.type(password, 'NuevaClave2026');
    await userEvent.type(confirm, 'NuevaClave2027');
    await userEvent.click(save);

    expect(authApi.confirmPasswordReset).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Las contraseñas no coinciden');
  });

  it('con campos vacíos no envía y muestra «Complete los campos obligatorios»', async () => {
    const { save } = await openForm();
    await userEvent.click(save);

    expect(authApi.confirmPasswordReset).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Complete los campos obligatorios');
  });

  it('muestra el mensaje de la API cuando rechaza el cambio', async () => {
    vi.mocked(authApi.confirmPasswordReset).mockRejectedValueOnce(new ApiError(POLICY, 400, { code: 'PASSWORD_RESET_WEAK' }));
    const { password, confirm, save } = await openForm();
    await userEvent.type(password, 'NuevaClave2026');
    await userEvent.type(confirm, 'NuevaClave2026');
    await userEvent.click(save);

    expect(await screen.findByRole('alert')).toHaveTextContent(POLICY);
    expect(screen.getByLabelText('Nueva contraseña')).toBeInTheDocument();
  });

  // Valor límite
  it('una contraseña de 7 caracteres muestra la política y la de 8 se acepta', async () => {
    const { password, confirm } = await openForm();
    await userEvent.type(password, 'Clave12');
    await userEvent.click(confirm);
    expect(screen.getByText(POLICY)).toBeInTheDocument();

    await userEvent.type(password, '3');
    expect(password).toHaveValue('Clave123');
    expect(screen.queryByText(POLICY)).not.toBeInTheDocument();
  });

  it('envía una contraseña de exactamente 8 caracteres', async () => {
    const { password, confirm, save } = await openForm();
    await userEvent.type(password, 'Clave123');
    await userEvent.type(confirm, 'Clave123');
    await userEvent.click(save);

    expect(authApi.confirmPasswordReset).toHaveBeenCalledWith(expect.objectContaining({ newPassword: 'Clave123' }));
  });
});
