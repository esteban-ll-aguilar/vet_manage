import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastContext } from '../../../common/components/toast-context';
import { appointmentsApi } from './appointments-api';
import { AppointmentsPage } from './appointments-page';

let permissions = new Set<string>();

vi.mock('../../auth/auth-context', () => ({ useAuth: () => ({ hasPermission: (key: string) => permissions.has(key) }) }));
vi.mock('./appointments-api', () => ({ appointmentsApi: { list: vi.fn(), cancel: vi.fn() } }));

function renderPage() {
  return render(
    <ToastContext.Provider value={{ showToast: vi.fn(), dismissToast: vi.fn(), confirm: vi.fn(async () => true) }}>
      <MemoryRouter>
        <AppointmentsPage />
      </MemoryRouter>
    </ToastContext.Provider>,
  );
}

describe('AppointmentsPage - Registrar cita presencial', () => {
  beforeEach(() => {
    vi.mocked(appointmentsApi.list).mockResolvedValue([]);
  });

  it('la recepcionista ve el botón y lleva al formulario de registro', async () => {
    permissions = new Set(['appointments:read', 'appointments:create']);
    renderPage();

    const link = await screen.findByRole('link', { name: 'Registrar cita presencial' });
    expect(link).toHaveAttribute('href', '/appointments/appointments/new');
  });

  it('sin appointments:create no aparece el botón', async () => {
    permissions = new Set(['appointments:read']);
    renderPage();

    await screen.findByText('No hay citas para mostrar');
    expect(screen.queryByRole('link', { name: 'Registrar cita presencial' })).not.toBeInTheDocument();
  });
});
