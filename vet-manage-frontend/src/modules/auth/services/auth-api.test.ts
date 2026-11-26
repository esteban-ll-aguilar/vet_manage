import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getJson, postJson } from '../../../infrastructure/api/http-client';
import { authApi } from './auth-api';

vi.mock('../../../infrastructure/api/http-client', () => ({
  getJson: vi.fn(),
  postJson: vi.fn(),
}));

describe('authApi – recuperación de contraseña (HU-58)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('solicita el enlace con el correo', async () => {
    await authApi.requestPasswordReset('ana@correo.com');

    expect(postJson).toHaveBeenCalledWith('/auth/password-reset/request', { email: 'ana@correo.com' });
  });

  it('valida el enlace codificando el token en la consulta', async () => {
    await authApi.validatePasswordReset('a+b/c=');

    expect(getJson).toHaveBeenCalledWith('/auth/password-reset/validate?token=a%2Bb%2Fc%3D');
  });

  it('confirma el restablecimiento con el token y las dos contraseñas', async () => {
    const input = { token: 't-1', newPassword: 'NuevaClave2026', confirmPassword: 'NuevaClave2026' };

    await authApi.confirmPasswordReset(input);

    expect(postJson).toHaveBeenCalledWith('/auth/password-reset/confirm', input);
  });
});
