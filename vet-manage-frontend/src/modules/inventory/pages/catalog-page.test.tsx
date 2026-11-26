import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../../auth/auth-context';
import type { AuthContextValue } from '../../auth/auth-context';
import { ToastContext } from '../../../common/components/toast-context';
import type { InventoryCategory } from '../types';
import { inventoryApi } from '../services/inventory-api';
import { CatalogPage } from './catalog-page';

vi.mock('../services/inventory-api', () => ({
  inventoryApi: {
    listCategories: vi.fn(),
    listBrands: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    createBrand: vi.fn(),
    updateBrand: vi.fn(),
    updateCategoryVat: vi.fn(),
  },
}));

const categories: InventoryCategory[] = [
  { id: 'category-1', name: 'Accesorios', description: 'Cuidado y paseo', vatRate: '12.5' },
  { id: 'category-2', name: 'Alimentos', vatRate: '0' },
  { id: 'category-3', name: 'Medicamentos', vatRate: null },
];

const session = {
  mustChangePassword: false,
  user: { id: 'user-1', firstName: 'Ana', lastName: 'Admin', email: 'ana@example.test', roles: [], permissions: [] },
};

function renderCatalogPage(
  hasPermission: AuthContextValue['hasPermission'] = (permission) =>
    permission === 'inventory:read' || permission === 'inventory:configure-vat',
  type: 'category' | 'brand' = 'category',
) {
  const showToast = vi.fn();
  const auth: AuthContextValue = {
    status: 'authenticated',
    session,
    login: vi.fn(async () => session),
    logout: vi.fn(async () => undefined),
    hasPermission,
  };

  const view = render(
    <AuthContext.Provider value={auth}>
      <ToastContext.Provider value={{ showToast, dismissToast: vi.fn(), confirm: vi.fn(async () => true) }}>
        <CatalogPage type={type} />
      </ToastContext.Provider>
    </AuthContext.Provider>,
  );

  return { showToast, ...view };
}

describe('CatalogPage category VAT (HU-23)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(inventoryApi.listCategories).mockResolvedValue(categories);
    vi.mocked(inventoryApi.listBrands).mockResolvedValue([{ id: 'brand-1', name: 'Kong' }]);
    vi.mocked(inventoryApi.updateCategoryVat).mockImplementation(async (id, vatRate) => {
      const current = categories.find((category) => category.id === id);
      if (!current) throw new Error('Categoría no encontrada');
      return { ...current, vatRate };
    });
  });

  it('shows configured rates, zero and an unconfigured category distinctly', async () => {
    renderCatalogPage();

    expect(await screen.findByText('12.5 %')).toBeInTheDocument();
    expect(screen.getByText('0 %')).toBeInTheDocument();
    expect(screen.getByText('Sin configurar')).toBeInTheDocument();
  });

  it('shows the IVA editor only with inventory:configure-vat, independently of category management', async () => {
    const { unmount } = renderCatalogPage((permission) => permission === 'inventory:read' || permission === 'inventory:configure-vat');

    expect(await screen.findByRole('button', { name: 'Editar IVA de Accesorios' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar categoría Accesorios' })).not.toBeInTheDocument();

    unmount();
    renderCatalogPage((permission) => permission === 'inventory:read' || permission === 'inventory:manage-categories');
    expect(await screen.findByText('12.5 %')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar IVA de Accesorios' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar categoría Accesorios' })).toBeInTheDocument();
  });

  it('saves the decimal string using the category UUID and changes the displayed value only after success', async () => {
    let completeRequest!: (category: InventoryCategory) => void;
    vi.mocked(inventoryApi.updateCategoryVat).mockReturnValue(new Promise((resolve) => {
      completeRequest = resolve;
    }));
    const { showToast } = renderCatalogPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Editar IVA de Accesorios' }));
    const input = screen.getByRole('textbox', { name: 'Nuevo IVA de Accesorios' });
    await userEvent.clear(input);
    await userEvent.type(input, '15.25');
    const saveButton = screen.getByRole('button', { name: 'Guardar IVA de Accesorios' });
    await userEvent.click(saveButton);

    expect(inventoryApi.updateCategoryVat).toHaveBeenCalledWith('category-1', '15.25');
    expect(await screen.findByText(/IVA vigente:/)).toBeInTheDocument();
    expect(screen.getByText('12.5 %')).toBeInTheDocument();
    expect(saveButton).toBeDisabled();

    await act(async () => completeRequest({ ...categories[0], vatRate: '15.25' }));

    expect(await screen.findByText('15.25 %')).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith('IVA actualizado correctamente', 'success');
  });

  it.each(['', '-5', '100.01', '12.345', 'letras'])(
    'rejects %s in the UI without sending a request',
    async (value) => {
      renderCatalogPage();
      await userEvent.click(await screen.findByRole('button', { name: 'Editar IVA de Accesorios' }));
      const input = screen.getByRole('textbox', { name: 'Nuevo IVA de Accesorios' });
      await userEvent.clear(input);
      if (value) await userEvent.type(input, value);
      await userEvent.click(screen.getByRole('button', { name: 'Guardar IVA de Accesorios' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'El IVA debe ser un porcentaje entre 0 y 100 con hasta dos decimales',
      );
      expect(inventoryApi.updateCategoryVat).not.toHaveBeenCalled();
      expect(screen.getByText(/IVA vigente:/)).toBeInTheDocument();
      expect(screen.getByText('12.5 %')).toBeInTheDocument();
    },
  );

  it('shows a server error and retains the confirmed rate after a failed update', async () => {
    const serverMessage = 'No se pudo guardar la configuración del IVA';
    vi.mocked(inventoryApi.updateCategoryVat).mockRejectedValue(new Error(serverMessage));
    const { showToast } = renderCatalogPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Editar IVA de Accesorios' }));
    const input = screen.getByRole('textbox', { name: 'Nuevo IVA de Accesorios' });
    await userEvent.clear(input);
    await userEvent.type(input, '20');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar IVA de Accesorios' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(serverMessage);
    expect(showToast).toHaveBeenCalledWith(serverMessage, 'error');
    expect(screen.getByText(/IVA vigente:/)).toBeInTheDocument();
    expect(screen.getByText('12.5 %')).toBeInTheDocument();
    expect(input).toHaveValue('20');

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar edición de IVA de Accesorios' }));
    expect(screen.getByText('12.5 %')).toBeInTheDocument();
  });

  it('updates one category without changing the confirmed IVA of another', async () => {
    renderCatalogPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Editar IVA de Accesorios' }));
    const input = screen.getByRole('textbox', { name: 'Nuevo IVA de Accesorios' });
    await userEvent.clear(input);
    await userEvent.type(input, '20');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar IVA de Accesorios' }));

    expect(await screen.findByText('20 %')).toBeInTheDocument();
    const foodRow = screen.getByText('Alimentos').closest('[role="listitem"]');
    expect(foodRow).not.toBeNull();
    expect(within(foodRow as HTMLElement).getByText('0 %')).toBeInTheDocument();
    expect(inventoryApi.updateCategoryVat).toHaveBeenCalledWith('category-1', '20');
  });

  it('keeps existing category name editing and its VAT display intact', async () => {
    vi.mocked(inventoryApi.updateCategory).mockResolvedValue({ ...categories[0], name: 'Accesorios premium' });
    renderCatalogPage((permission) => permission === 'inventory:read' || permission === 'inventory:manage-categories');

    await userEvent.click(await screen.findByRole('button', { name: 'Editar categoría Accesorios' }));
    await userEvent.clear(screen.getByRole('textbox', { name: 'Nombre de categoría' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Nombre de categoría' }), 'Accesorios premium');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(inventoryApi.updateCategory).toHaveBeenCalledWith('category-1', {
      name: 'Accesorios premium',
      description: 'Cuidado y paseo',
    });
    expect(await screen.findByText('Accesorios premium')).toBeInTheDocument();
    expect(screen.getByText('12.5 %')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar IVA de Accesorios premium' })).not.toBeInTheDocument();
  });

  it('does not render category VAT controls in the brands catalog', async () => {
    renderCatalogPage(() => true, 'brand');

    expect(await screen.findByText('Kong')).toBeInTheDocument();
    expect(screen.queryByText('IVA')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar IVA/ })).not.toBeInTheDocument();
  });
});
