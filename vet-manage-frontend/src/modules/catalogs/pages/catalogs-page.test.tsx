import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogsPage } from './catalogs-page';

vi.mock('../../pets/pages/species-page', () => ({ SpeciesPage: () => <p>Panel de especies</p> }));
vi.mock('../../pets/pages/breeds-page', () => ({ BreedsPage: () => <p>Panel de razas</p> }));

let permissions = new Set<string>();
vi.mock('../../auth/auth-context', () => ({
  useAuth: () => ({ hasPermission: (permission: string) => permissions.has(permission) }),
}));

describe('CatalogsPage', () => {
  beforeEach(() => {
    permissions = new Set();
  });

  it('muestra la pestaña Especies a quien tiene species:read', () => {
    permissions = new Set(['species:read', 'breeds:read']);
    render(<CatalogsPage />);

    expect(screen.getByRole('tab', { name: 'Especies' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Panel de especies')).toBeInTheDocument();
  });

  it('oculta Especies sin species:read y abre la primera pestaña permitida', () => {
    permissions = new Set(['breeds:read']);
    render(<CatalogsPage />);

    expect(screen.queryByRole('tab', { name: 'Especies' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Razas' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText('Panel de especies')).not.toBeInTheDocument();
    expect(screen.getByText('Panel de razas')).toBeInTheDocument();
  });
});
