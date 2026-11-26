import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { sessionToken } from '../../infrastructure/api/session-token';
import { AuthContext } from './auth-context';
import type { AuthContextValue, AuthStatus } from './auth-context';
import { authApi } from './services/auth-api';
import type { LoginCredentials, LoginResult, SessionProfile } from './types';

function toProfile({ mustChangePassword, user }: LoginResult): SessionProfile {
  return { mustChangePassword, user };
}

// Mantiene la sesión del usuario y la recupera al recargar con el refresh token de la cookie.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionProfile | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const endSession = useCallback(() => {
    setSession(null);
    setStatus('anonymous');
  }, []);

  const startSession = useCallback((result: LoginResult) => {
    sessionToken.set(result.accessToken);
    setSession(toProfile(result));
    setStatus('authenticated');
  }, []);

  useEffect(() => sessionToken.onExpired(endSession), [endSession]);

  // Cada renovación trae los roles y permisos vigentes.
  useEffect(() => sessionToken.onRefreshed((result) => {
    setSession(toProfile(result as LoginResult));
    setStatus('authenticated');
  }), []);

  useEffect(() => {
    let cancelled = false;
    void sessionToken.refresh().then((result) => {
      if (!cancelled && !result) endSession();
    });
    return () => {
      cancelled = true;
    };
  }, [endSession]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const result = await authApi.login(credentials);
    startSession(result);
    return toProfile(result);
  }, [startSession]);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => undefined);
    sessionToken.clear();
    endSession();
  }, [endSession]);

  const clearMustChangePassword = useCallback(() => {
    setSession((current) => (current ? { ...current, mustChangePassword: false } : current));
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const permissions = new Set(session?.user.permissions);
    return {
      status,
      session,
      login,
      logout,
      hasPermission: (permission) => permissions.has(permission),
      clearMustChangePassword,
    };
  }, [clearMustChangePassword, login, logout, session, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
