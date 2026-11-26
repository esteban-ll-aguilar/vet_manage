export type SessionRole = { name: string; displayName: string };

export type SessionUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: SessionRole[];
  permissions: string[];
};

export type SessionProfile = { mustChangePassword: boolean; user: SessionUser };

export type LoginResult = SessionProfile & { accessToken: string };

export type LoginCredentials = { email: string; password: string };

export type PasswordResetConfirmInput = {
  token: string;
  newPassword: string;
  confirmPassword: string;
};

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};
