import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../../../infrastructure/api/http-client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../../common/components/toast';
import { AuthContext, type AuthContextValue } from '../../auth/auth-context';
import { RequirePermission } from '../../auth/components/require-permission';
import { clientsApi } from '../services/clients-api';
import type { ClientListItem, ClientPage, ClientPet, ClientStatus } from '../types';
import { ClientsPage } from './clients-page';

vi.mock('../services/clients-api', () => ({
  clientsApi: {
    list: vi.fn(),
    pets: vi.fn(),
    inactivate: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn(),
    update: vi.fn(),
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
      <ToastProvider>
        <MemoryRouter>
          <RequirePermission permission="clients:read">
            <ClientsPage />
          </RequirePermission>
        </MemoryRouter>
      </ToastProvider>
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

  it('muestra Inactivar solo para clientes activos con permiso clients:inactivate', async () => {
    vi.mocked(clientsApi.list).mockResolvedValue({
      items: [
        makeClient('1', 'Luis', 'Mena', 'ACTIVE'),
        makeClient('2', 'Ana', 'Aguilar', 'INACTIVE'),
        makeClient('3', 'Carlos', 'Baja', 'DEACTIVATED'),
      ],
      total: 3,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });

    renderPage();
    const table = await screen.findByRole('table', { name: 'Clientes' });
    const rows = within(table).getAllByRole('row').slice(1);

    expect(within(rows[0]).getByRole('button', { name: 'Inactivar' })).toBeInTheDocument();
    expect(within(rows[1]).queryByRole('button', { name: 'Inactivar' })).not.toBeInTheDocument();
    expect(within(rows[2]).queryByRole('button', { name: 'Inactivar' })).not.toBeInTheDocument();
  });

  it('oculta Inactivar cuando el usuario no tiene clients:inactivate', async () => {
    renderPage({ hasPermission: (permission) => permission === 'clients:read' });
    await screen.findByRole('table', { name: 'Clientes' });

    expect(screen.queryByRole('button', { name: 'Inactivar' })).not.toBeInTheDocument();
  });

  it('inactiva un cliente tras confirmar y conserva el acceso a sus mascotas', async () => {
    vi.mocked(clientsApi.inactivate).mockResolvedValue({ id: '2', status: 'INACTIVE' });
    renderPage();
    await screen.findByText('Luis Mena');

    await userEvent.click(screen.getByRole('button', { name: 'Inactivar' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Luis Mena')).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(clientsApi.inactivate).toHaveBeenCalledWith('2'));
    expect(await screen.findByRole('status')).toHaveTextContent('Cliente inactivado correctamente');
    expect(screen.getByRole('status').closest('.toast')).not.toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver mascotas de Luis Mena' })).toBeInTheDocument();
  });

  it('cancela la inactivación sin llamar a la API', async () => {
    renderPage();
    await screen.findByText('Luis Mena');

    await userEvent.click(screen.getByRole('button', { name: 'Inactivar' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(clientsApi.inactivate).not.toHaveBeenCalled();
  });

  it('muestra el mensaje de error del backend si falla la inactivación', async () => {
    vi.mocked(clientsApi.inactivate).mockRejectedValue(new Error('No se puede inactivar un cliente dado de baja'));
    renderPage();
    await screen.findByText('Luis Mena');

    await userEvent.click(screen.getByRole('button', { name: 'Inactivar' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No se puede inactivar un cliente dado de baja');
    expect(alert.closest('.toast')).not.toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  describe('Editar cliente (HU-02)', () => {
    it('muestra Editar a quien tiene clients:update, salvo en clientes dados de baja', async () => {
      vi.mocked(clientsApi.list).mockResolvedValue({
        items: [
          makeClient('1', 'Luis', 'Mena', 'ACTIVE'),
          makeClient('2', 'Ana', 'Aguilar', 'INACTIVE'),
          makeClient('3', 'Carlos', 'Baja', 'DEACTIVATED'),
        ],
        total: 3,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });

      renderPage();
      const rows = within(await screen.findByRole('table', { name: 'Clientes' })).getAllByRole('row').slice(1);

      expect(within(rows[0]).getByRole('button', { name: 'Editar a Luis Mena' })).toBeInTheDocument();
      expect(within(rows[1]).getByRole('button', { name: 'Editar a Ana Aguilar' })).toBeInTheDocument();
      expect(within(rows[2]).queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
    });

    it('muestra la columna de acciones solo con Editar cuando falta clients:inactivate', async () => {
      renderPage({ hasPermission: (permission) => permission === 'clients:read' || permission === 'clients:update' });
      await screen.findByText('Luis Mena');

      expect(screen.getByRole('columnheader', { name: 'Acciones' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Editar a Luis Mena' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Inactivar' })).not.toBeInTheDocument();
    });

    it('oculta Editar sin el permiso clients:update', async () => {
      renderPage({ hasPermission: (permission) => permission === 'clients:read' });
      await screen.findByText('Luis Mena');

      expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('columnheader', { name: 'Acciones' })).not.toBeInTheDocument();
    });

    it('guarda los cambios, cierra el formulario y actualiza la fila', async () => {
      vi.mocked(clientsApi.update).mockResolvedValue({
        id: '2', identification: '0924321', firstName: 'Luis Alberto', lastName: 'Mena',
        email: '2@example.test', phone: '0992222222', address: null, status: 'ACTIVE',
      });
      renderPage();
      await userEvent.click(await screen.findByRole('button', { name: 'Editar a Luis Mena' }));

      const dialog = screen.getByRole('dialog', { name: 'Editar cliente' });
      await userEvent.clear(within(dialog).getByLabelText(/nombres/i));
      await userEvent.type(within(dialog).getByLabelText(/nombres/i), 'Luis Alberto');
      await userEvent.type(within(dialog).getByLabelText(/teléfono/i), '0992222222');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar Cambios' }));

      await waitFor(() => expect(clientsApi.update).toHaveBeenCalledWith('2', {
        firstName: 'Luis Alberto', lastName: 'Mena', email: '2@example.test', phone: '0992222222', address: '',
      }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(await screen.findByRole('status')).toHaveTextContent('Datos actualizados correctamente');
      expect(screen.getByRole('status').closest('.toast')).not.toBeNull();
      expect(screen.getByText('Luis Alberto Mena')).toBeInTheDocument();
    });

    it('cancela la edición sin llamar a la API ni cambiar la fila', async () => {
      renderPage();
      await userEvent.click(await screen.findByRole('button', { name: 'Editar a Luis Mena' }));

      const dialog = screen.getByRole('dialog', { name: 'Editar cliente' });
      await userEvent.type(within(dialog).getByLabelText(/teléfono/i), '0992222222');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(clientsApi.update).not.toHaveBeenCalled();
      expect(screen.getByText('Luis Mena')).toBeInTheDocument();
    });

    it('mantiene el formulario abierto y resalta el correo si la API lo rechaza', async () => {
      vi.mocked(clientsApi.update).mockRejectedValue(
        new ApiError('El correo ya se encuentra registrado', 409, { code: 'CLIENT_EMAIL_TAKEN', errors: ['email'] }),
      );
      renderPage();
      await userEvent.click(await screen.findByRole('button', { name: 'Editar a Luis Mena' }));

      const dialog = screen.getByRole('dialog', { name: 'Editar cliente' });
      await userEvent.type(within(dialog).getByLabelText(/teléfono/i), '0992222222');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar Cambios' }));

      expect(await within(dialog).findByRole('alert')).toHaveTextContent('El correo ya se encuentra registrado');
      expect(within(dialog).getByLabelText(/correo electrónico/i)).toHaveAttribute('aria-invalid', 'true');
    });
  });
  describe('Activar cliente (HU-05)', () => {
    const mixedPage = (): ClientPage => ({
      items: [
        makeClient('1', 'Luis', 'Mena', 'ACTIVE'),
        makeClient('2', 'Ana', 'Aguilar', 'INACTIVE'),
        makeClient('3', 'Carlos', 'Baja', 'DEACTIVATED'),
      ],
      total: 3,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });

    it('muestra Activar solo en los clientes inactivos y ninguna acción de estado en los dados de baja (escenario 5)', async () => {
      vi.mocked(clientsApi.list).mockResolvedValue(mixedPage());
      renderPage();
      const table = await screen.findByRole('table', { name: 'Clientes' });
      const rows = within(table).getAllByRole('row').slice(1);

      expect(within(rows[0]).queryByRole('button', { name: 'Activar' })).not.toBeInTheDocument();
      expect(within(rows[1]).getByRole('button', { name: 'Activar' })).toBeInTheDocument();
      expect(within(rows[1]).queryByRole('button', { name: 'Inactivar' })).not.toBeInTheDocument();
      expect(within(rows[2]).queryByRole('button', { name: 'Activar' })).not.toBeInTheDocument();
      expect(within(rows[2]).queryByRole('button', { name: 'Inactivar' })).not.toBeInTheDocument();
    });

    it('oculta Activar sin el permiso clients:activate', async () => {
      renderPage({ hasPermission: (permission) => permission !== 'clients:activate' });
      await screen.findByText('Ana Aguilar');

      expect(screen.queryByRole('button', { name: 'Activar' })).not.toBeInTheDocument();
    });

    it('muestra la columna de acciones solo con Activar cuando es el único permiso de estado', async () => {
      renderPage({ hasPermission: (permission) => permission === 'clients:read' || permission === 'clients:activate' });
      await screen.findByText('Ana Aguilar');

      expect(screen.getByRole('columnheader', { name: 'Acciones' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Activar' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Inactivar' })).not.toBeInTheDocument();
    });

    it('activa un cliente tras confirmar, actualiza la fila y muestra el toast (escenario 1)', async () => {
      vi.mocked(clientsApi.activate).mockResolvedValue({ id: '1', status: 'ACTIVE' });
      renderPage();
      await screen.findByText('Ana Aguilar');

      await userEvent.click(screen.getByRole('button', { name: 'Activar' }));
      const dialog = screen.getByRole('dialog', { name: 'Activar cliente' });
      expect(within(dialog).getByText('Ana Aguilar')).toBeInTheDocument();
      expect(within(dialog).getByText('1@example.test')).toBeInTheDocument();
      const badges = within(dialog).getAllByText(/^(Activo|Inactivo)$/).map((badge) => badge.textContent);
      expect(badges).toEqual(['Inactivo', 'Activo']);

      await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }));

      await waitFor(() => expect(clientsApi.activate).toHaveBeenCalledWith('1'));
      expect(clientsApi.inactivate).not.toHaveBeenCalled();
      expect(await screen.findByRole('status')).toHaveTextContent('Cliente activado correctamente');
      expect(screen.getByRole('status').closest('.toast')).not.toBeNull();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      const row = screen.getByText('Ana Aguilar').closest('tr') as HTMLElement;
      expect(within(row).getByText('Activo')).toBeInTheDocument();
      expect(within(row).getByRole('button', { name: 'Inactivar' })).toBeInTheDocument();
      expect(within(row).getByRole('button', { name: 'Ver mascotas de Ana Aguilar' })).toBeInTheDocument();
    });

    it('recarga la lista si hay un filtro de estado activo', async () => {
      vi.mocked(clientsApi.activate).mockResolvedValue({ id: '1', status: 'ACTIVE' });
      renderPage();
      await screen.findByText('Ana Aguilar');
      await userEvent.selectOptions(screen.getByLabelText('Filtrar por estado'), 'INACTIVE');
      await screen.findByText('Ana Aguilar');
      vi.mocked(clientsApi.list).mockClear();

      await userEvent.click(screen.getByRole('button', { name: 'Activar' }));
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar' }));

      await waitFor(() => expect(clientsApi.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'INACTIVE' })));
    });

    it('cancela la activación sin llamar a la API y deja al cliente inactivo (escenario 4)', async () => {
      renderPage();
      await screen.findByText('Ana Aguilar');

      await userEvent.click(screen.getByRole('button', { name: 'Activar' }));
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(clientsApi.activate).not.toHaveBeenCalled();
      const row = screen.getByText('Ana Aguilar').closest('tr') as HTMLElement;
      expect(within(row).getByText('Inactivo')).toBeInTheDocument();
    });

    it('deshabilita Confirmar y Cancelar mientras se activa', async () => {
      let finish: (value: { id: string; status: 'ACTIVE' }) => void = () => undefined;
      vi.mocked(clientsApi.activate).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
      renderPage();
      await screen.findByText('Ana Aguilar');

      await userEvent.click(screen.getByRole('button', { name: 'Activar' }));
      const dialog = screen.getByRole('dialog');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }));

      expect(within(dialog).getByRole('button', { name: 'Guardando…' })).toBeDisabled();
      expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toBeDisabled();
      finish({ id: '1', status: 'ACTIVE' });
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('muestra en un toast el error de la API y no cambia la fila', async () => {
      vi.mocked(clientsApi.activate).mockRejectedValue(
        new ApiError('No se puede activar un cliente dado de baja', 400, { code: 'CLIENT_STATUS_DEACTIVATED' }),
      );
      renderPage();
      await screen.findByText('Ana Aguilar');

      await userEvent.click(screen.getByRole('button', { name: 'Activar' }));
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar' }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('No se puede activar un cliente dado de baja');
      expect(alert.closest('.toast')).not.toBeNull();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      const row = screen.getByText('Ana Aguilar').closest('tr') as HTMLElement;
      expect(within(row).getByText('Inactivo')).toBeInTheDocument();
    });

    it('mantiene el diálogo de inactivar con su título y su transición', async () => {
      renderPage();
      await screen.findByText('Luis Mena');

      await userEvent.click(screen.getByRole('button', { name: 'Inactivar' }));
      const dialog = screen.getByRole('dialog', { name: 'Inactivar cliente' });
      const badges = within(dialog).getAllByText(/^(Activo|Inactivo)$/).map((badge) => badge.textContent);

      expect(badges).toEqual(['Activo', 'Inactivo']);
    });
  });
});

describe('ClientsPage – dar de baja un cliente (HU-03)', () => {
  const pageWith = (...items: ClientListItem[]): ClientPage => ({ items, total: items.length, page: 1, pageSize: 20, totalPages: 1 });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clientsApi.pets).mockResolvedValue([]);
  });

  // Positivos
  it('muestra «Dar de baja» a quien tiene clients:deactivate en clientes Activo e Inactivo', async () => {
    vi.mocked(clientsApi.list).mockResolvedValue(pageWith(
      makeClient('a1', 'Ana', 'Activa', 'ACTIVE'),
      makeClient('i1', 'Iván', 'Inactivo', 'INACTIVE'),
    ));
    renderPage({ hasPermission: (permission) => ['clients:read', 'clients:deactivate'].includes(permission) });

    expect(await screen.findByRole('button', { name: 'Dar de baja a Ana Activa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dar de baja a Iván Inactivo' })).toBeInTheDocument();
  });

  it('da de baja con motivo, recarga la lista y muestra la confirmación', async () => {
    const active = makeClient('a1', 'Ana', 'Activa', 'ACTIVE');
    vi.mocked(clientsApi.list)
      .mockResolvedValueOnce(pageWith(active))
      .mockResolvedValueOnce(pageWith({ ...active, status: 'DEACTIVATED', deactivatedAt: '2026-11-24T15:00:00.000Z', deactivationReason: 'Se mudó', deactivatedBy: 'Gabriel Gerente' }));
    vi.mocked(clientsApi.deactivate).mockResolvedValue({ id: 'a1', status: 'DEACTIVATED', deactivatedAt: '2026-11-24T15:00:00.000Z', deactivationReason: 'Se mudó' });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Dar de baja a Ana Activa' }));
    await userEvent.type(screen.getByLabelText(/motivo de la baja/i), 'Se mudó');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar baja' }));

    await waitFor(() => expect(clientsApi.deactivate).toHaveBeenCalledWith('a1', 'Se mudó'));
    expect(await screen.findByText('Cliente dado de baja correctamente')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const table = screen.getByRole('table', { name: 'Clientes' });
    expect(within(table).getByText('De baja')).toBeInTheDocument();
    expect(within(table).queryByRole('button', { name: /dar de baja/i })).not.toBeInTheDocument();
  });

  it('muestra en solo lectura la fecha, el responsable y el motivo de un cliente de baja', async () => {
    vi.mocked(clientsApi.list).mockResolvedValue(pageWith({
      ...makeClient('d1', 'Hugo', 'Vivanco', 'DEACTIVATED'),
      deactivatedAt: '2026-11-24T15:00:00.000Z',
      deactivationReason: 'Solicitud del cliente',
      deactivatedBy: 'Valeria Veterinaria',
    }));
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Ver mascotas de Hugo Vivanco' }));
    const data = await screen.findByLabelText('Datos de la baja');
    expect(data).toHaveTextContent('Valeria Veterinaria');
    expect(data).toHaveTextContent('Solicitud del cliente');
    expect(screen.queryByRole('button', { name: /editar a hugo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /dar de baja a hugo/i })).not.toBeInTheDocument();
  });

  // Negativos
  it('no muestra «Dar de baja» sin el permiso clients:deactivate (Recepcionista)', async () => {
    vi.mocked(clientsApi.list).mockResolvedValue(pageWith(makeClient('a1', 'Ana', 'Activa', 'ACTIVE')));
    renderPage({ hasPermission: (permission) => ['clients:read', 'clients:inactivate', 'clients:update'].includes(permission) });

    await screen.findByText('Ana Activa');
    expect(screen.queryByRole('button', { name: /dar de baja/i })).not.toBeInTheDocument();
  });

  it('Cancelar no llama a la API ni cambia el estado', async () => {
    vi.mocked(clientsApi.list).mockResolvedValue(pageWith(makeClient('i1', 'Iván', 'Inactivo', 'INACTIVE')));
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Dar de baja a Iván Inactivo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(clientsApi.deactivate).not.toHaveBeenCalled();
    expect(within(screen.getByRole('table', { name: 'Clientes' })).getByText('Inactivo')).toBeInTheDocument();
  });

  it('si la API rechaza la baja, el modal muestra el mensaje y el cliente no cambia', async () => {
    vi.mocked(clientsApi.list).mockResolvedValue(pageWith(makeClient('a1', 'Ana', 'Activa', 'ACTIVE')));
    vi.mocked(clientsApi.deactivate).mockRejectedValue(new ApiError('El cliente está desactivado', 409));
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Dar de baja a Ana Activa' }));
    await userEvent.type(screen.getByLabelText(/motivo de la baja/i), 'Motivo');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar baja' }));

    const dialog = screen.getByRole('dialog');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('El cliente está desactivado');
    expect(clientsApi.list).toHaveBeenCalledTimes(1);
  });
});
