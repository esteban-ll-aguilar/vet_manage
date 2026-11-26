import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastContext } from '../../../common/components/toast-context';
import { AuthContext } from '../../auth/auth-context';
import { RequirePermission } from '../../auth/components/require-permission';
import { inventoryApi } from '../services/inventory-api';
import type { Product } from '../types';
import { ProductsPage } from './products-page';

vi.mock('../services/inventory-api', () => ({
  inventoryApi: { listProducts: vi.fn(), listCategories: vi.fn(), listBrands: vi.fn() },
}));

const showToast = vi.fn();
const product: Product = {
  id: 'product-1',
  code: 'PR-DEMO-013',
  name: 'Pelota resistente para perro',
  description: null,
  unitPrice: '13.40',
  stock: 0,
  category: { id: 'category-1', name: 'Juguetes' },
  brand: { id: 'brand-1', name: 'Kong' },
  createdAt: '2026-11-19T00:00:00.000Z',
};

function renderPage(allowed = true) {
  return render(
    <MemoryRouter>
      <ToastContext.Provider value={{ showToast, dismissToast: vi.fn(), confirm: vi.fn(async () => true) }}>
        <AuthContext.Provider value={{
          status: 'authenticated',
          session: null,
          login: vi.fn(),
          logout: vi.fn(),
          hasPermission: () => allowed,
        }}>
          <RequirePermission permission="inventory:read">
            <ProductsPage />
          </RequirePermission>
        </AuthContext.Provider>
      </ToastContext.Provider>
    </MemoryRouter>,
  );
}

describe('ProductsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(inventoryApi.listProducts).mockResolvedValue([product]);
    vi.mocked(inventoryApi.listCategories).mockResolvedValue([
      { id: 'category-1', name: 'Juguetes', vatRate: null },
      { id: 'category-2', name: 'Alimentos', vatRate: null },
    ]);
    vi.mocked(inventoryApi.listBrands).mockResolvedValue([
      { id: 'brand-1', name: 'Kong' },
      { id: 'brand-2', name: 'Dog Chow' },
    ]);
  });

  it('muestra el mensaje de búsqueda vacía y permite recuperar el catálogo', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(product.name);
    vi.mocked(inventoryApi.listProducts).mockResolvedValueOnce([]);

    const input = screen.getByRole('textbox', { name: 'Buscar productos' });
    await user.type(input, 'inexistente');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    await screen.findByText('No se encontraron productos');
    expect(screen.queryByText('No hay productos todavía')).not.toBeInTheDocument();
    expect(screen.queryByText(product.name)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Registrar producto' })).not.toBeInTheDocument();

    await user.clear(input);
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    await screen.findByText(product.name);
    expect(inventoryApi.listProducts).toHaveBeenLastCalledWith('', { categoryId: '', brandId: '', batchCode: '' });
  });

  it.each(['KONG', '13', '13.40'])('envía la búsqueda %s al pulsar Enter', async (search) => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(product.name);

    await user.type(screen.getByRole('textbox', { name: 'Buscar productos' }), search);
    await user.keyboard('{Enter}');

    await waitFor(() => expect(inventoryApi.listProducts).toHaveBeenLastCalledWith(
      search, { categoryId: '', brandId: '', batchCode: '' },
    ));
    expect(await screen.findByText(product.name)).toBeInTheDocument();
  });

  it('muestra el estado de catálogo vacío cuando no hay productos y no se buscó', async () => {
    vi.mocked(inventoryApi.listProducts).mockResolvedValue([]);
    renderPage();

    await screen.findByText('No hay productos todavía');
    expect(screen.getByRole('link', { name: 'Registrar producto' })).toBeInTheDocument();
  });

  it('informa un error de carga sin presentarlo como búsqueda sin coincidencias', async () => {
    vi.mocked(inventoryApi.listProducts).mockRejectedValue(new Error('Sin conexión'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar el catálogo.');
    expect(showToast).toHaveBeenCalledWith('Sin conexión', 'error');
    expect(screen.queryByText('No se encontraron productos')).not.toBeInTheDocument();
  });

  it('permite reintentar la misma consulta después de un error', async () => {
    const user = userEvent.setup();
    vi.mocked(inventoryApi.listProducts).mockRejectedValueOnce(new Error('Sin conexión'));
    renderPage();
    await screen.findByRole('alert');

    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    await screen.findByText(product.name);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(inventoryApi.listProducts).toHaveBeenCalledTimes(2);
  });

  it('conserva la búsqueda más reciente si la carga inicial termina después', async () => {
    const user = userEvent.setup();
    let completeInitial!: (products: Product[]) => void;
    vi.mocked(inventoryApi.listProducts).mockImplementationOnce(() => new Promise((resolve) => {
      completeInitial = resolve;
    }));
    renderPage();

    await user.type(screen.getByRole('textbox', { name: 'Buscar productos' }), 'Kong');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    await screen.findByText(product.name);

    await act(async () => completeInitial([]));

    expect(screen.getByText(product.name)).toBeInTheDocument();
    expect(screen.queryByText('No se encontraron productos')).not.toBeInTheDocument();
  });

  it('combina categoría y marca y permite limpiar los filtros', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(product.name);
    await screen.findByRole('option', { name: 'Dog Chow' });
    const food = {
      ...product,
      id: 'product-2',
      name: 'Alimento para perro',
      category: { id: 'category-2', name: 'Alimentos' },
      brand: { id: 'brand-2', name: 'Dog Chow' },
    };
    vi.mocked(inventoryApi.listProducts).mockResolvedValueOnce([food]);

    await user.selectOptions(screen.getByLabelText('Categoría'), 'category-2');
    await user.selectOptions(screen.getByLabelText('Marca'), 'brand-2');
    await user.type(screen.getByLabelText('Código de lote'), 'L-2026-001');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    await screen.findByText(food.name);
    expect(screen.queryByText(product.name)).not.toBeInTheDocument();
    expect(inventoryApi.listProducts).toHaveBeenLastCalledWith('', {
      categoryId: 'category-2', brandId: 'brand-2', batchCode: 'L-2026-001',
    });

    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

    await screen.findByText(product.name);
    expect(screen.getByLabelText('Categoría')).toHaveValue('');
    expect(screen.getByLabelText('Marca')).toHaveValue('');
    expect(screen.getByLabelText('Código de lote')).toHaveValue('');
    expect(inventoryApi.listProducts).toHaveBeenLastCalledWith('', {
      categoryId: '', brandId: '', batchCode: '',
    });
  });

  it('muestra búsqueda sin resultados cuando solo se seleccionó una categoría', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('option', { name: 'Alimentos' });
    vi.mocked(inventoryApi.listProducts).mockResolvedValueOnce([]);

    await user.selectOptions(screen.getByLabelText('Categoría'), 'category-2');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    await screen.findByText('No se encontraron productos');
    expect(screen.queryByText('No hay productos todavía')).not.toBeInTheDocument();
  });

  it('impide consultar productos en la pantalla sin permiso de inventario', async () => {
    renderPage(false);

    expect(screen.getByRole('alert')).toHaveTextContent('No tiene permisos para realizar esta acción');
    expect(inventoryApi.listProducts).not.toHaveBeenCalled();
    expect(inventoryApi.listCategories).not.toHaveBeenCalled();
    expect(inventoryApi.listBrands).not.toHaveBeenCalled();
  });

  it('envía el código completo de lote al pulsar Enter en su campo', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(product.name);

    await user.type(screen.getByLabelText('Código de lote'), ' l-2026-001 ');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(inventoryApi.listProducts).toHaveBeenLastCalledWith('', {
      categoryId: '', brandId: '', batchCode: 'l-2026-001',
    }));
  });
});
