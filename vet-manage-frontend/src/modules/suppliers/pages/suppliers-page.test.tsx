import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../../auth/auth-context';
import type { AuthContextValue } from '../../auth/auth-context';
import { RequirePermission } from '../../auth/components/require-permission';
import { suppliersApi } from '../services/suppliers-api';
import type { SupplierListResponse } from '../types';
import { SuppliersPage } from './suppliers-page';

vi.mock('../services/suppliers-api', () => ({
  suppliersApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

const activeSupplier = {
  id: 'supplier-1',
  businessName: 'Distribuidora Activa',
  ruc: '0012345678001',
  isActive: true,
  createdAt: '2026-11-20T10:00:00.000Z',
  updatedAt: '2026-11-20T10:00:00.000Z',
};
const inactiveSupplier = {
  ...activeSupplier,
  id: 'supplier-2',
  businessName: 'Distribuidora Inactiva',
  ruc: '0009876543001',
  isActive: false,
};
const firstPage: SupplierListResponse = {
  items: [activeSupplier, inactiveSupplier],
  page: 1,
  pageSize: 10,
  total: 11,
  totalPages: 2,
};
const secondPage: SupplierListResponse = {
  items: [{ ...activeSupplier, id: 'supplier-11', businessName: 'Último proveedor' }],
  page: 2,
  pageSize: 10,
  total: 11,
  totalPages: 2,
};

const session = {
  mustChangePassword: false,
  user: { id: 'manager-1', firstName: 'Gerente', lastName: 'Vet', email: 'manager@example.test', roles: [], permissions: [] },
};

function renderSuppliersPage(
  hasPermission: AuthContextValue['hasPermission'] = () => true,
  guardRead = false,
) {
  const auth: AuthContextValue = {
    status: 'authenticated',
    session,
    login: vi.fn(async () => session),
    logout: vi.fn(async () => undefined),
    hasPermission,
  };
  const page = guardRead
    ? <RequirePermission permission="suppliers:read"><SuppliersPage /></RequirePermission>
    : <SuppliersPage />;

  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/inventory/suppliers']}>{page}</MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('SuppliersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(suppliersApi.list).mockResolvedValue(firstPage);
  });

  it('muestra razón social, RUC y estados Activo/Inactivo', async () => {
    renderSuppliersPage();

    expect(await screen.findByText('Distribuidora Activa')).toBeInTheDocument();
    expect(screen.getByText('0012345678001')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.getByText('Distribuidora Inactiva')).toBeInTheDocument();
    expect(screen.getByText('0009876543001')).toBeInTheDocument();
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
  });

  it('consulta la página siguiente usando el resultado de paginación del servidor', async () => {
    vi.mocked(suppliersApi.list)
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(secondPage);
    renderSuppliersPage();

    expect(await screen.findByText('Página 1 de 2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(await screen.findByText('Último proveedor')).toBeInTheDocument();
    expect(suppliersApi.list).toHaveBeenNthCalledWith(2, { page: 2, pageSize: 10 });
    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument();
  });

  it('envía búsqueda y filtro de inactivos al backend', async () => {
    vi.mocked(suppliersApi.list).mockResolvedValueOnce(firstPage).mockResolvedValueOnce({
      items: [inactiveSupplier], page: 1, pageSize: 10, total: 1, totalPages: 1,
    });
    renderSuppliersPage();

    await screen.findByText('Distribuidora Activa');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar por razón social o RUC' }), 'Distribuidora');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Estado' }), 'INACTIVE');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() => expect(suppliersApi.list).toHaveBeenNthCalledWith(2, {
      page: 1,
      pageSize: 10,
      search: 'Distribuidora',
      status: 'INACTIVE',
    }));
    expect(await screen.findByText('Distribuidora Inactiva')).toBeInTheDocument();
  });

  it('muestra estados de carga, lista vacía y permite reintentar errores', async () => {
    let finishRequest!: (result: SupplierListResponse) => void;
    vi.mocked(suppliersApi.list).mockReturnValueOnce(new Promise((resolve) => { finishRequest = resolve; }));
    renderSuppliersPage();
    expect(screen.getByRole('status')).toHaveTextContent('Cargando proveedores');

    finishRequest({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 });
    expect(await screen.findByText('Aún no hay proveedores registrados')).toBeInTheDocument();

    vi.mocked(suppliersApi.list).mockRejectedValueOnce(new Error('No hay conexión'));
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No hay conexión');

    vi.mocked(suppliersApi.list).mockResolvedValueOnce(firstPage);
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Distribuidora Activa')).toBeInTheDocument();
  });

  it('oculta registro y edición sin sus permisos y explica que desactivar no está disponible', async () => {
    renderSuppliersPage((permission) => permission === 'suppliers:read');

    await screen.findByText('Distribuidora Activa');
    expect(screen.queryByRole('link', { name: /Registrar proveedor/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Editar proveedor Distribuidora Activa' })).not.toBeInTheDocument();
    expect(screen.getByText(/se integre la verificación de órdenes de compra pendientes/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /desactivar/i })).not.toBeInTheDocument();
  });

  it('protege la consulta con suppliers:read mediante el control RBAC compartido', async () => {
    renderSuppliersPage(() => false, true);

    expect(screen.getByRole('alert')).toHaveTextContent('No tiene permisos para realizar esta acción');
    expect(suppliersApi.list).not.toHaveBeenCalled();
  });
});
