import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastContext } from '../../../common/components/toast-context';
import { AuthContext } from '../../auth/auth-context';
import type { AuthContextValue } from '../../auth/auth-context';
import { RequirePermission } from '../../auth/components/require-permission';
import { ApiError } from '../../../infrastructure/api/http-client';
import { suppliersApi } from '../services/suppliers-api';
import type { Supplier } from '../types';
import { SupplierFormPage } from './supplier-form-page';

vi.mock('../services/suppliers-api', () => ({
  suppliersApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

const supplier: Supplier = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  businessName: 'Distribuidora Vet',
  ruc: '0012345678001',
  isActive: false,
  createdAt: '2026-11-20T10:00:00.000Z',
  updatedAt: '2026-11-20T10:00:00.000Z',
};
const allPermissions = new Set(['suppliers:read', 'suppliers:create', 'suppliers:update']);
const session = {
  mustChangePassword: false,
  user: { id: 'manager-1', firstName: 'Gerente', lastName: 'Vet', email: 'manager@example.test', roles: [], permissions: [] },
};

function renderSupplierForm(
  initialPath = '/inventory/suppliers/new',
  hasPermission: AuthContextValue['hasPermission'] = (permission) => allPermissions.has(permission),
  guardPermission?: string,
) {
  const showToast = vi.fn();
  const auth: AuthContextValue = {
    status: 'authenticated',
    session,
    login: vi.fn(async () => session),
    logout: vi.fn(async () => undefined),
    hasPermission,
  };
  const page = guardPermission
    ? <RequirePermission permission={guardPermission}><SupplierFormPage /></RequirePermission>
    : <SupplierFormPage />;

  const view = render(
    <AuthContext.Provider value={auth}>
      <ToastContext.Provider value={{ showToast, dismissToast: vi.fn(), confirm: vi.fn(async () => true) }}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route path="/inventory/suppliers/new" element={page} />
            <Route path="/inventory/suppliers/:id/edit" element={page} />
            <Route path="/inventory/suppliers" element={<h2>Listado de proveedores</h2>} />
            <Route path="/" element={<h2>Inicio</h2>} />
          </Routes>
        </MemoryRouter>
      </ToastContext.Provider>
    </AuthContext.Provider>,
  );

  return { showToast, ...view };
}

describe('SupplierFormPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(suppliersApi.get).mockResolvedValue(supplier);
    vi.mocked(suppliersApi.create).mockResolvedValue(supplier);
    vi.mocked(suppliersApi.update).mockResolvedValue(supplier);
  });

  it('valida los campos vacíos antes de enviar', async () => {
    renderSupplierForm();

    await userEvent.click(screen.getByRole('button', { name: 'Registrar proveedor' }));

    expect(await screen.findByText('La razón social es obligatoria.')).toBeInTheDocument();
    expect(screen.getByText('El RUC es obligatorio.')).toBeInTheDocument();
    expect(suppliersApi.create).not.toHaveBeenCalled();
  });

  it('filtra caracteres no numéricos y alerta si se intenta guardar un RUC corto', async () => {
    renderSupplierForm();
    const ruc = screen.getByLabelText(/^RUC/);

    await userEvent.type(ruc, '12A');
    expect(ruc).toHaveValue('12');
    expect(screen.getByText('El RUC solo admite dígitos numéricos.')).toBeInTheDocument();

    await userEvent.clear(ruc);
    await userEvent.type(ruc, '123456789012');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar proveedor' }));

    expect(await screen.findByText('El RUC debe contener exactamente 13 dígitos numéricos.')).toBeInTheDocument();
    expect(suppliersApi.create).not.toHaveBeenCalled();
  });

  it('registra sin convertir ni perder los ceros iniciales del RUC', async () => {
    const { showToast } = renderSupplierForm();

    await userEvent.type(screen.getByLabelText(/^Razón social/), ' Distribuidora Nueva ');
    await userEvent.type(screen.getByLabelText(/^RUC/), '0001234567001');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar proveedor' }));

    await screen.findByRole('heading', { name: 'Listado de proveedores' });
    expect(suppliersApi.create).toHaveBeenCalledWith({ businessName: 'Distribuidora Nueva', ruc: '0001234567001' });
    expect(showToast).toHaveBeenCalledWith('Proveedor registrado correctamente', 'success');
  });

  it('muestra conflicto de RUC y conserva lo escrito', async () => {
    vi.mocked(suppliersApi.create).mockRejectedValueOnce(new ApiError('El RUC ya está registrado', 409));
    const { showToast } = renderSupplierForm();

    await userEvent.type(screen.getByLabelText(/^Razón social/), 'Empresa nueva');
    await userEvent.type(screen.getByLabelText(/^RUC/), '0012345678001');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar proveedor' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El RUC ya está registrado');
    expect(screen.getByLabelText(/^Razón social/)).toHaveValue('Empresa nueva');
    expect(screen.getByLabelText(/^RUC/)).toHaveValue('0012345678001');
    expect(screen.getByLabelText(/^RUC/)).toHaveAttribute('aria-invalid', 'true');
    expect(showToast).toHaveBeenCalledWith('El RUC ya está registrado', 'error');
  });

  it('carga un proveedor existente y actualiza solo razón social y RUC conservando el UUID', async () => {
    const { showToast } = renderSupplierForm(`/inventory/suppliers/${supplier.id}/edit`);

    expect(await screen.findByLabelText(/^Razón social/)).toHaveValue('Distribuidora Vet');
    expect(screen.getByLabelText(/^RUC/)).toHaveValue('0012345678001');
    expect(screen.getByText('Inactivo')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText(/^Razón social/));
    await userEvent.type(screen.getByLabelText(/^Razón social/), 'Razón social actualizada');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await screen.findByRole('heading', { name: 'Listado de proveedores' });
    expect(suppliersApi.update).toHaveBeenCalledWith(supplier.id, {
      businessName: 'Razón social actualizada',
      ruc: '0012345678001',
    });
    expect(showToast).toHaveBeenCalledWith('Proveedor actualizado correctamente', 'success');
  });

  it.each([
    [400, 'Revise los campos enviados.', 'Revise los campos enviados.'],
    [403, 'No autorizado.', 'No tiene permisos para realizar esta acción.'],
    [404, 'Proveedor eliminado.', 'No se encontró el proveedor. Actualice el listado e inténtelo nuevamente.'],
    [409, 'El RUC ya está registrado.', 'El RUC ya está registrado.'],
  ])('maneja errores HTTP %s y mantiene los campos editados', async (status, serverMessage, expectedMessage) => {
    vi.mocked(suppliersApi.update).mockRejectedValueOnce(new ApiError(serverMessage, status));
    renderSupplierForm(`/inventory/suppliers/${supplier.id}/edit`);

    const businessName = await screen.findByLabelText(/^Razón social/);
    await userEvent.clear(businessName);
    await userEvent.type(businessName, 'Nombre no perdido');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(expectedMessage);
    expect(businessName).toHaveValue('Nombre no perdido');
    if (status === 409) expect(screen.getByLabelText(/^RUC/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('muestra error 404 al cargar un proveedor que ya no existe', async () => {
    vi.mocked(suppliersApi.get).mockRejectedValueOnce(new ApiError('Proveedor no encontrado', 404));
    renderSupplierForm(`/inventory/suppliers/${supplier.id}/edit`);

    expect(await screen.findByRole('alert')).toHaveTextContent('No se encontró el proveedor');
    expect(screen.queryByLabelText(/^Razón social/)).not.toBeInTheDocument();
  });

  it('no presenta el formulario sin permiso de creación', () => {
    renderSupplierForm('/inventory/suppliers/new', () => false, 'suppliers:create');

    expect(screen.getByRole('alert')).toHaveTextContent('No tiene permisos para realizar esta acción');
    expect(screen.queryByLabelText(/^Razón social/)).not.toBeInTheDocument();
    expect(suppliersApi.create).not.toHaveBeenCalled();
  });

  it('no presenta edición sin permiso suppliers:update', async () => {
    renderSupplierForm(`/inventory/suppliers/${supplier.id}/edit`, (permission) => permission === 'suppliers:read', 'suppliers:update');

    expect(screen.getByRole('alert')).toHaveTextContent('No tiene permisos para realizar esta acción');
    expect(screen.queryByLabelText(/^Razón social/)).not.toBeInTheDocument();
    await waitFor(() => expect(suppliersApi.get).not.toHaveBeenCalled());
    expect(suppliersApi.update).not.toHaveBeenCalled();
  });
});
