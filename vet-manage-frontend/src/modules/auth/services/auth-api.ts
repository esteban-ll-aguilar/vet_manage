import { getJson, postJson } from '../../../infrastructure/api/http-client';
import type { ChangePasswordInput, LoginCredentials, LoginResult, PasswordResetConfirmInput, SessionProfile } from '../types';

export const authApi = {
  login(credentials: LoginCredentials) {
    return postJson<LoginResult, LoginCredentials>('/auth/login', credentials);
  },
  logout() {
    return postJson<null, Record<string, never>>('/auth/logout', {});
  },
  me() {
    return getJson<SessionProfile>('/auth/me');
  },
  changePassword(input: ChangePasswordInput) {
    return postJson<null, ChangePasswordInput>('/auth/change-password', input);
  },
  // Recuperación de contraseña (HU-58): rutas públicas, sin sesión.
  requestPasswordReset(email: string) {
    return postJson<null, { email: string }>('/auth/password-reset/request', { email });
  },
  validatePasswordReset(token: string) {
    return getJson<{ valid: boolean }>(`/auth/password-reset/validate?token=${encodeURIComponent(token)}`);
  },
  confirmPasswordReset(input: PasswordResetConfirmInput) {
    return postJson<null, PasswordResetConfirmInput>('/auth/password-reset/confirm', input);
  },
};
