import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../../auth/auth-context';
import { RequirePermission } from '../../auth/components/require-permission';
import { clientsApi } from '../services/clients-api';
import type { ClientListItem, ClientPage, ClientPet, ClientStatus } from '../types';
import { ClientsPage } from './clients-page';

vi.mock('../services/clients-api', () => ({
  clientsApi: {
    list: vi.fn(),
    pets: vi.fn(),
  },
}));

function makeClient(id: string, firstName: string, lastName: string, status: ClientStatus = 'ACTIVE'): ClientListItem {
  return {
    id,
    personId: `p-${id}`,
    identification: `09${id}4321`,
    firstName,
    lastName,
    email: `${id}@example.test`,
    phone: null,
    address: null,
    status,
    roles: [{ name: 'client', displayName: 'Cliente' }],
    createdAt: '2026-11-19T12:00:00.000Z',
  };
}

function makePage(page: number, total: number): ClientPage {
  const size = Math.min(20, Math.max(0, total - (page - 1) * 20));
  return {
    items: Array.from({ length: size }, (_, index) => makeClient(`c${page}${index}`, `Cliente${page}${index}`, `Apellido${page}${index}`)),
    total,
    page,
    pageSize: 20,
    totalPages: Math.ceil(total / 20),
  };
}

function renderPage(overrides: Partial<AuthContextValue> = {}) {
  const auth: AuthContextValue = {
    status: 'authenticated',
    session: null,
    login: vi.fn(async () => ({
      mustChangePassword: false,
      user: { id: 'staff', firstName: 'Ana', lastName: 'Admin', email: 'admin@example.test', roles: [], permissions: [] },
    })),
    logout: vi.fn(async () => undefined),
    hasPermission: () => true,
    ...overrides,
  };

  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter>
        <RequirePermission permission="clients:read">
          <ClientsPage />
        </RequirePermission>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('ClientsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clientsApi.pets).mockResolvedValue([]);
    vi.mocked(clientsApi.list).mockResolvedValue({
      items: [makeClient('1', 'Ana', 'Aguilar', 'INACTIVE'), makeClient('2', 'Luis', 'Mena')],
      total: 2,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });
  });

  it('muestra el listado inicial y elimina el placeholder', async () => {
    renderPage();

    const table = await screen.findByRole('table', { name: 'Clientes' });
    expect(within(table).getByText('Ana Aguilar')).toBeInTheDocument();
    expect(within(table).getByText('1@example.test')).toBeInTheDocument();
    expect(within(table).getByText('Inactivo')).toBeInTheDocument();
    expect(screen.getByText('2 clientes')).toBeInTheDocument();
    expect(screen.queryByText(/próximamente/i)).not.toBeInTheDocument();
    expect(clientsApi.list).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });

  it('busca por cédula y por nombre con el botón Buscar', async () => {
    renderPage();
    await screen.findByText('Ana Aguilar');

    const input = screen.getByLabelText('Buscar clientes');
    await userEvent.type(input, '0987654321');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(clientsApi.list).toHaveBeenLastCalledWith({ search: '0987654321', page: 1, pageSize: 20 }));

    await userEvent.clear(input);
    await userEvent.type(input, 'josé');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(clientsApi.list).toHaveBeenLastCalledWith({ search: 'josé', page: 1, pageSize: 20 }));
  });

  it('no consulta cuando el término tiene menos de 2 caracteres', async () => {
    renderPage();
    await screen.findByText('Ana Aguilar');

    await userEvent.type(screen.getByLabelText('Buscar clientes'), 'a');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Ingrese al menos 2 caracteres para buscar por nombre o los 10 dígitos de la cédula');
    expect(clientsApi.list).toHaveBeenCalledTimes(1);
  });

  it('conserva la búsqueda al avanzar de página', async () => {
    vi.mocked(clientsApi.list).mockImplementation(async (query = {}) => makePage(query.page ?? 1, 45));
    renderPage();
    await screen.findByText(/Cliente10/);

    await userEvent.type(screen.getByLabelText('Buscar clientes'), 'Pérez');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await screen.findByText(/Cliente10/);
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    await waitFor(() => expect(clientsApi.list).toHaveBeenLastCalledWith({ search: 'Pérez', page: 2, pageSize: 20 }));
    expect(await screen.findByText('Página 2 de 3')).toBeInTheDocument();
  });

  it('muestra las mascotas vinculadas al expandir un cliente', async () => {
    const pets: ClientPet[] = [{
      id: 'pet1',
      code: 'PAC-000001',
      name: 'Firulais',
      species: 'Canino',
      breed: 'Labrador',
      status: 'ACTIVE',
    }];
    vi.mocked(clientsApi.pets).mockResolvedValue(pets);
    renderPage();
    await screen.findByText('Ana Aguilar');

    await userEvent.click(screen.getByRole('button', { name: 'Ver mascotas de Ana Aguilar' }));

    expect(await screen.findByText('Firulais')).toBeInTheDocument();
    expect(screen.getByText('PAC-000001')).toBeInTheDocument();
    expect(screen.getByText('Canino · Labrador')).toBeInTheDocument();
    expect(clientsApi.pets).toHaveBeenCalledWith('1');
  });

  it('indica cuando el cliente no tiene mascotas y cuando falla la consulta', async () => {
    renderPage();
    await screen.findByText('Ana Aguilar');

    await userEvent.click(screen.getByRole('button', { name: 'Ver mascotas de Ana Aguilar' }));
    expect(await screen.findByText('Sin mascotas vinculadas')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Ocultar mascotas de Ana Aguilar' }));
    vi.mocked(clientsApi.pets).mockRejectedValueOnce(new Error('No se pudieron cargar las mascotas.'));
    await userEvent.click(screen.getByRole('button', { name: 'Ver mascotas de Ana Aguilar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar las mascotas.');
  });

  it('muestra el mensaje exacto de sin resultados y el enlace de registro', async () => {
    vi.mocked(clientsApi.list).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 });
    renderPage();

    expect(await screen.findByText('No se encontraron clientes registrados con el criterio ingresado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Registrar nuevo cliente' })).toHaveAttribute('href', '/clients/new');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('oculta el registro cuando el usuario no tiene clients:create', async () => {
    vi.mocked(clientsApi.list).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 });
    renderPage({ hasPermission: (permission) => permission === 'clients:read' });

    expect(await screen.findByText('No se encontraron clientes registrados con el criterio ingresado')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Registrar nuevo cliente' })).not.toBeInTheDocument();
  });

  it('niega la vista a un usuario sin clients:read', () => {
    renderPage({ hasPermission: () => false });

    expect(screen.getByText('No tiene permisos para realizar esta acción')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(clientsApi.list).not.toHaveBeenCalled();
  });
});
