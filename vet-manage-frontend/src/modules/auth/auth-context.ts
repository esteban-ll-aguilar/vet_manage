import { createContext, useContext } from 'react';
import type { LoginCredentials, SessionProfile } from './types';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export type AuthContextValue = {
  status: AuthStatus;
  session: SessionProfile | null;
  login: (credentials: LoginCredentials) => Promise<SessionProfile>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  clearMustChangePassword?: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe utilizarse dentro de AuthProvider');
  return context;
}
