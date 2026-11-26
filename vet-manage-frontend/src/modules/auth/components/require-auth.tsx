import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth-context';

// Muestra las rutas hijas solo con sesión iniciada; exige cambio de contraseña si es obligatorio.
export function RequireAuth() {
  const { status, session } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <div className="auth-loading" role="status">Cargando sesión…</div>;
  }
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (session?.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }
  return <Outlet />;
}
