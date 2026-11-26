import type { ReactNode } from 'react';
import { useAuth } from '../auth-context';

export const NO_PERMISSION_MESSAGE = 'No tiene permisos para realizar esta acción';

// Muestra el contenido solo si el usuario tiene el permiso (o uno de la lista); si no, un aviso de acceso denegado.
export function RequirePermission({ permission, children }: { permission: string | readonly string[]; children: ReactNode }) {
  const { hasPermission } = useAuth();
  const allowed = typeof permission === 'string' ? hasPermission(permission) : permission.some(hasPermission);

  if (!allowed) {
    return (
      <section className="empty-page" role="alert">
        <span className="eyebrow">Acceso restringido</span>
        <h2>{NO_PERMISSION_MESSAGE}</h2>
        <p>Si necesita acceder a esta sección, solicite el permiso al Administrador.</p>
      </section>
    );
  }
  return <>{children}</>;
}
