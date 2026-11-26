import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NO_PERMISSION_MESSAGE, RequirePermission } from './require-permission';

let permissions = new Set<string>();
vi.mock('../auth-context', () => ({
  useAuth: () => ({ hasPermission: (permission: string) => permissions.has(permission) }),
}));

describe('RequirePermission', () => {
  beforeEach(() => {
    permissions = new Set(['breeds:read']);
  });

  it('muestra el contenido con el permiso pedido', () => {
    render(<RequirePermission permission="breeds:read"><p>Contenido</p></RequirePermission>);

    expect(screen.getByText('Contenido')).toBeInTheDocument();
  });

  it('bloquea la ruta sin el permiso pedido', () => {
    render(<RequirePermission permission="species:read"><p>Contenido</p></RequirePermission>);

    expect(screen.queryByText('Contenido')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(NO_PERMISSION_MESSAGE);
  });

  it('con una lista basta tener uno de los permisos', () => {
    render(<RequirePermission permission={['species:read', 'breeds:read']}><p>Contenido</p></RequirePermission>);

    expect(screen.getByText('Contenido')).toBeInTheDocument();
  });

  it('con una lista bloquea si no tiene ninguno', () => {
    render(<RequirePermission permission={['species:read', 'procedure-types:read']}><p>Contenido</p></RequirePermission>);

    expect(screen.queryByText('Contenido')).not.toBeInTheDocument();
  });
});
