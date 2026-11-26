import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastContext } from '../../../common/components/toast-context';
import { breedApi } from '../services/breed.service';
import { speciesApi } from '../services/species.service';
import type { Breed } from '../types';
import { BreedsPage } from './breeds-page';

vi.mock('../services/breed.service', () => ({
  breedApi: {
    listBreeds: vi.fn(),
    registerBreed: vi.fn(),
    updateBreed: vi.fn(),
    getBreed: vi.fn(),
    inactivateBreed: vi.fn(),
    activateBreed: vi.fn(),
  },
}));
vi.mock('../services/species.service', () => ({ speciesApi: { listActiveSpecies: vi.fn(), listSpecies: vi.fn() } }));

let permissions = new Set<string>();
vi.mock('../../auth/auth-context', () => ({
  useAuth: () => ({ hasPermission: (permission: string) => permissions.has(permission) }),
}));

const showToast = vi.fn();
const confirm = vi.fn(async () => true);

const sampleBreeds: Breed[] = [
  {
    id: 'br-1',
    name: 'Labrador',
    description: 'Perro amigable',
    isActive: true,
    speciesId: 'sp-1',
    species: { id: 'sp-1', name: 'Canino' },
    createdAt: '2026-11-18T00:00:00.000Z',
    updatedAt: '2026-11-18T00:00:00.000Z',
  },
];

function renderPage() {
  return render(
    <ToastContext.Provider value={{ showToast, dismissToast: vi.fn(), confirm }}>
      <BreedsPage />
    </ToastContext.Provider>,
  );
}

describe('BreedsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissions = new Set(['breeds:read', 'breeds:create', 'breeds:update', 'breeds:change-status', 'species:read']);
    confirm.mockResolvedValue(true);
    vi.mocked(breedApi.listBreeds).mockResolvedValue(sampleBreeds);
    vi.mocked(speciesApi.listActiveSpecies).mockResolvedValue([
      { id: 'sp-1', name: 'Canino' },
      { id: 'sp-2', name: 'Felino' },
    ]);
    vi.mocked(speciesApi.listSpecies).mockResolvedValue([
      { id: 'sp-1', name: 'Canino', isActive: true, createdAt: '', updatedAt: '' },
      { id: 'sp-2', name: 'Felino', isActive: true, createdAt: '', updatedAt: '' },
      { id: 'sp-3', name: 'Reptil', isActive: false, createdAt: '', updatedAt: '' },
    ]);
  });

  it('registra una raza, muestra la confirmación y cierra el formulario', async () => {
    vi.mocked(breedApi.registerBreed).mockResolvedValue({
      id: 'br-2',
      name: 'Poodle',
      description: null,
      isActive: true,
      speciesId: 'sp-1',
      createdAt: '2026-11-18T00:00:00.000Z',
      updatedAt: '2026-11-18T00:00:00.000Z',
    });
    renderPage();
    await screen.findByText('Labrador');

    await userEvent.click(screen.getByRole('button', { name: /nueva raza/i }));
    const dialog = screen.getByRole('dialog');
    await within(dialog).findByRole('option', { name: 'Canino' });
    await userEvent.type(within(dialog).getByLabelText(/nombre de la raza/i), 'Poodle');
    await userEvent.selectOptions(within(dialog).getByLabelText(/especie/i), 'sp-1');
    await userEvent.click(within(dialog).getByRole('button', { name: /guardar raza/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(breedApi.registerBreed).toHaveBeenCalledWith({ name: 'Poodle', speciesId: 'sp-1', description: undefined });
    expect(showToast).toHaveBeenCalledWith('Raza registrada exitosamente', 'success');
  });

  it('muestra el error y recarga las especies cuando el registro falla', async () => {
    vi.mocked(breedApi.registerBreed).mockRejectedValue(new Error('La especie seleccionada está inactiva'));
    renderPage();
    await screen.findByText('Labrador');

    await userEvent.click(screen.getByRole('button', { name: /nueva raza/i }));
    const dialog = screen.getByRole('dialog');
    await within(dialog).findByRole('option', { name: 'Canino' });
    await userEvent.type(within(dialog).getByLabelText(/nombre de la raza/i), 'Labrador');
    await userEvent.selectOptions(within(dialog).getByLabelText(/especie/i), 'sp-1');
    await userEvent.click(within(dialog).getByRole('button', { name: /guardar raza/i }));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('La especie seleccionada está inactiva', 'error'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(speciesApi.listActiveSpecies).toHaveBeenCalledTimes(2);
  });

  it('cierra el formulario con Cancelar sin registrar nada', async () => {
    renderPage();
    await screen.findByText('Labrador');

    await userEvent.click(screen.getByRole('button', { name: /nueva raza/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(breedApi.registerBreed).not.toHaveBeenCalled();
  });

  it('oculta "Nueva raza" y "Editar" a quien solo consulta razas', async () => {
    permissions = new Set(['breeds:read']);
    renderPage();

    await screen.findByText('Labrador');
    expect(screen.queryByRole('button', { name: /nueva raza/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /inactivar|activar/i })).not.toBeInTheDocument();
  });

  it('inactiva una raza solo después de confirmar y actualiza su disponibilidad', async () => {
    vi.mocked(breedApi.inactivateBreed).mockResolvedValue({
      id: 'br-1',
      isActive: false,
      updatedAt: '2026-11-26T00:00:00.000Z',
    });
    renderPage();
    await screen.findByText('Labrador');

    await userEvent.click(screen.getByRole('button', { name: 'Inactivar Labrador' }));

    expect(confirm).toHaveBeenCalledWith(
      '¿Confirmas que deseas inactivar la raza "Labrador"?',
      'Sí, inactivar',
      'danger',
    );
    await waitFor(() => expect(breedApi.inactivateBreed).toHaveBeenCalledWith('br-1'));
    expect(await screen.findByText('Inactiva')).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith('Raza inactivada correctamente', 'success');
  });

  it('conserva el estado al cancelar la confirmación', async () => {
    confirm.mockResolvedValueOnce(false);
    renderPage();
    await screen.findByText('Labrador');

    await userEvent.click(screen.getByRole('button', { name: 'Inactivar Labrador' }));

    expect(breedApi.inactivateBreed).not.toHaveBeenCalled();
    expect(screen.getByText('Activa')).toBeInTheDocument();
  });

  it('activa una raza inactiva después de confirmar', async () => {
    vi.mocked(breedApi.listBreeds).mockResolvedValue([{ ...sampleBreeds[0], isActive: false }]);
    vi.mocked(breedApi.activateBreed).mockResolvedValue({
      id: 'br-1',
      isActive: true,
      updatedAt: '2026-11-26T00:00:00.000Z',
    });
    renderPage();
    await screen.findByText('Labrador');

    await userEvent.click(screen.getByRole('button', { name: 'Activar Labrador' }));

    await waitFor(() => expect(breedApi.activateBreed).toHaveBeenCalledWith('br-1'));
    expect(await screen.findByText('Activa')).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith('Raza activada correctamente', 'success');
  });

  it('actualiza una raza exitosamente y muestra toast de confirmación', async () => {
    vi.mocked(breedApi.updateBreed).mockResolvedValue({
      ...sampleBreeds[0],
      name: 'Labrador Retriever',
      speciesId: 'sp-2',
      species: { id: 'sp-2', name: 'Felino' },
      description: 'Descripción actualizada',
    });
    renderPage();
    await screen.findByText('Labrador');

    await userEvent.click(screen.getByRole('button', { name: 'Editar Labrador' }));
    const dialog = screen.getByRole('dialog');
    await within(dialog).findByRole('option', { name: 'Felino' });

    const nameInput = within(dialog).getByLabelText(/nombre de la raza/i);
    const speciesSelect = within(dialog).getByLabelText(/especie/i);
    const descInput = within(dialog).getByLabelText(/descripción/i);

    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Labrador Retriever');
    await userEvent.selectOptions(speciesSelect, 'sp-2');
    await userEvent.clear(descInput);
    await userEvent.type(descInput, 'Descripción actualizada');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(breedApi.updateBreed).toHaveBeenCalledWith('br-1', {
        name: 'Labrador Retriever',
        speciesId: 'sp-2',
        description: 'Descripción actualizada',
      });
    });
    expect(showToast).toHaveBeenCalledWith('Raza actualizada exitosamente', 'success');
    expect(await screen.findByText('Labrador Retriever')).toBeInTheDocument();
  });

  it('permite actualizar una raza dejando la descripción vacía', async () => {
    vi.mocked(breedApi.updateBreed).mockResolvedValue({
      ...sampleBreeds[0],
      description: null,
    });
    renderPage();
    await screen.findByText('Labrador');

    await userEvent.click(screen.getByRole('button', { name: 'Editar Labrador' }));
    const dialog = screen.getByRole('dialog');
    await within(dialog).findByRole('option', { name: 'Canino' });

    await userEvent.clear(within(dialog).getByLabelText(/descripción/i));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(breedApi.updateBreed).toHaveBeenCalledWith('br-1', {
        name: 'Labrador',
        speciesId: 'sp-1',
        description: undefined,
      });
    });
  });

  it('impide actualizar si se elimina el nombre o la especie', async () => {
    renderPage();
    await screen.findByText('Labrador');

    await userEvent.click(screen.getByRole('button', { name: 'Editar Labrador' }));
    const dialog = screen.getByRole('dialog');
    await within(dialog).findByRole('option', { name: 'Canino' });

    await userEvent.clear(within(dialog).getByLabelText(/nombre de la raza/i));
    await userEvent.selectOptions(within(dialog).getByLabelText(/especie/i), '');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));

    expect(within(dialog).getByText('El nombre de la raza es obligatorio')).toBeInTheDocument();
    expect(within(dialog).getByText('Debes asociar la raza a una especie')).toBeInTheDocument();
    expect(breedApi.updateBreed).not.toHaveBeenCalled();
  });

  it('descarta los cambios al presionar Cancelar en edición', async () => {
    renderPage();
    await screen.findByText('Labrador');

    await userEvent.click(screen.getByRole('button', { name: 'Editar Labrador' }));
    const dialog = screen.getByRole('dialog');
    await within(dialog).findByRole('option', { name: 'Canino' });

    const nameInput = within(dialog).getByLabelText(/nombre de la raza/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Cambio descartado');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(breedApi.updateBreed).not.toHaveBeenCalled();
    expect(screen.getByText('Labrador')).toBeInTheDocument();
  });
});

describe('BreedsPage – consultar raza (HU-20)', () => {
  const siames: Breed = {
    id: 'br-3',
    name: 'Siamés',
    description: null,
    isActive: false,
    speciesId: 'sp-2',
    species: { id: 'sp-2', name: 'Felino' },
    createdAt: '2026-11-18T00:00:00.000Z',
    updatedAt: '2026-11-18T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    permissions = new Set(['breeds:read', 'species:read']);
    vi.mocked(breedApi.listBreeds).mockResolvedValue([...sampleBreeds, siames]);
    vi.mocked(speciesApi.listSpecies).mockResolvedValue([
      { id: 'sp-1', name: 'Canino', isActive: true, createdAt: '', updatedAt: '' },
      { id: 'sp-2', name: 'Felino', isActive: true, createdAt: '', updatedAt: '' },
      { id: 'sp-3', name: 'Reptil', isActive: false, createdAt: '', updatedAt: '' },
    ]);
  });

  // Positivos
  it('busca por nombre después de dejar de escribir', async () => {
    renderPage();
    await screen.findByText('Labrador');
    vi.mocked(breedApi.listBreeds).mockResolvedValue(sampleBreeds);

    await userEvent.type(screen.getByLabelText('Buscar raza por nombre'), 'labra');

    await waitFor(() => expect(breedApi.listBreeds).toHaveBeenLastCalledWith({ search: 'labra', speciesId: undefined }));
    await waitFor(() => expect(screen.queryByText('Siamés')).not.toBeInTheDocument());
  });

  it('vuelve al listado completo al limpiar la búsqueda', async () => {
    renderPage();
    await screen.findByText('Labrador');
    const input = screen.getByLabelText('Buscar raza por nombre');
    await userEvent.type(input, 'x');
    await waitFor(() => expect(breedApi.listBreeds).toHaveBeenLastCalledWith({ search: 'x', speciesId: undefined }));

    await userEvent.clear(input);
    await waitFor(() => expect(breedApi.listBreeds).toHaveBeenLastCalledWith({ search: '', speciesId: undefined }));
  });

  it('filtra por especie y ofrece también especies inactivas', async () => {
    renderPage();
    await screen.findByText('Labrador');
    const filter = screen.getByLabelText('Filtrar por especie');
    expect(await within(filter).findByRole('option', { name: 'Reptil (inactiva)' })).toBeInTheDocument();

    await userEvent.selectOptions(filter, 'sp-2');
    await waitFor(() => expect(breedApi.listBreeds).toHaveBeenLastCalledWith({ search: '', speciesId: 'sp-2' }));
  });

  it('combina búsqueda y especie', async () => {
    renderPage();
    await screen.findByText('Labrador');
    await userEvent.selectOptions(screen.getByLabelText('Filtrar por especie'), 'sp-1');
    await userEvent.type(screen.getByLabelText('Buscar raza por nombre'), 'mestizo');

    await waitFor(() => expect(breedApi.listBreeds).toHaveBeenLastCalledWith({ search: 'mestizo', speciesId: 'sp-1' }));
  });

  it('muestra el detalle de una raza en solo lectura', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Ver detalle de Labrador' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Labrador' })).toBeInTheDocument();
    expect(within(dialog).getByText('Canino')).toBeInTheDocument();
    expect(within(dialog).getByText('Perro amigable')).toBeInTheDocument();
    expect(within(dialog).getByText('Activa')).toBeInTheDocument();
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /guardar/i })).not.toBeInTheDocument();
  });

  it('muestra «Sin descripción» y el estado Inactiva en el detalle', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Ver detalle de Siamés' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Sin descripción')).toBeInTheDocument();
    expect(within(dialog).getByText('Inactiva')).toBeInTheDocument();
  });

  // Negativos
  it('muestra el mensaje cuando no hay razas que coincidan', async () => {
    renderPage();
    await screen.findByText('Labrador');
    vi.mocked(breedApi.listBreeds).mockResolvedValue([]);

    await userEvent.type(screen.getByLabelText('Buscar raza por nombre'), 'xyz');

    expect(await screen.findByText('No se encontraron razas con el criterio ingresado')).toBeInTheDocument();
  });

  it('muestra el error de la API y conserva la búsqueda escrita', async () => {
    renderPage();
    await screen.findByText('Labrador');
    vi.mocked(breedApi.listBreeds).mockRejectedValue(new Error('No se pudo conectar con el servidor'));

    await userEvent.type(screen.getByLabelText('Buscar raza por nombre'), 'labra');

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor');
    expect(screen.getByLabelText('Buscar raza por nombre')).toHaveValue('labra');
  });

  it('cierra el detalle con Escape', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Ver detalle de Labrador' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // Valor límite
  it('limita la búsqueda a 100 caracteres', async () => {
    renderPage();
    await screen.findByText('Labrador');
    const input = screen.getByLabelText('Buscar raza por nombre');

    await userEvent.click(input);
    await userEvent.paste('b'.repeat(101));

    expect(input).toHaveValue('b'.repeat(100));
  });

  it('acepta una búsqueda de 1 carácter', async () => {
    renderPage();
    await screen.findByText('Labrador');
    await userEvent.type(screen.getByLabelText('Buscar raza por nombre'), 'p');

    await waitFor(() => expect(breedApi.listBreeds).toHaveBeenLastCalledWith({ search: 'p', speciesId: undefined }));
  });
});
