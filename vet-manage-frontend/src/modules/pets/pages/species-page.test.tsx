import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastContext } from '../../../common/components/toast-context';
import { speciesApi } from '../services/species.service';
import type { Species } from '../types';
import { SpeciesPage } from './species-page';

vi.mock('../services/species.service', () => ({
  speciesApi: {
    listSpecies: vi.fn(),
    registerSpecies: vi.fn(),
    updateSpecies: vi.fn(),
    changeStatus: vi.fn(),
  },
}));

let permissions = new Set<string>();
vi.mock('../../auth/auth-context', () => ({
  useAuth: () => ({ hasPermission: (permission: string) => permissions.has(permission) }),
}));

const sampleSpecies: Species[] = [
  {
    id: 'sp-1',
    name: 'Canino',
    description: 'Perros domésticos',
    isActive: true,
    createdAt: '2026-11-18T00:00:00.000Z',
    updatedAt: '2026-11-18T00:00:00.000Z',
  },
];

function renderPage() {
  const showToast = vi.fn();
  render(
    <ToastContext.Provider value={{ showToast, dismissToast: vi.fn(), confirm: vi.fn(async () => true) }}>
      <SpeciesPage />
    </ToastContext.Provider>,
  );
  return { showToast };
}

describe('SpeciesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissions = new Set();
    vi.mocked(speciesApi.listSpecies).mockResolvedValue(sampleSpecies);
  });

  it('muestra "Nueva especie" con el permiso species:create (Veterinario)', async () => {
    permissions = new Set(['species:read', 'species:create']);
    renderPage();

    expect(screen.getByRole('button', { name: /nueva especie/i })).toBeInTheDocument();
    expect(await screen.findByText('Canino')).toBeInTheDocument();
  });

  it('oculta "Nueva especie" y "Editar" a quien solo consulta especies', async () => {
    permissions = new Set(['species:read']);
    renderPage();

    await screen.findByText('Canino');
    expect(screen.queryByRole('button', { name: /nueva especie/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
  });

  it('filtra las especies por coincidencia parcial del nombre sin distinguir mayúsculas', async () => {
    vi.mocked(speciesApi.listSpecies).mockResolvedValue([
      ...sampleSpecies,
      {
        ...sampleSpecies[0],
        id: 'sp-2',
        name: 'Felino',
        description: 'Gatos domésticos',
      },
    ]);
    permissions = new Set(['species:read']);
    renderPage();
    await screen.findByText('Canino');

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar especies por nombre' }), 'fEL');

    expect(screen.getByText('Felino')).toBeInTheDocument();
    expect(screen.queryByText('Canino')).not.toBeInTheDocument();
  });

  it('muestra un mensaje cuando la búsqueda no encuentra especies', async () => {
    permissions = new Set(['species:read']);
    renderPage();
    await screen.findByText('Canino');

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar especies por nombre' }), 'Inexistente');

    expect(screen.getByRole('status')).toHaveTextContent('No se encontraron especies');
    expect(screen.queryByText('Canino')).not.toBeInTheDocument();
  });

  it('muestra nombre, descripción y estado al seleccionar un resultado', async () => {
    vi.mocked(speciesApi.listSpecies).mockResolvedValue([{ ...sampleSpecies[0], isActive: false }]);
    permissions = new Set(['species:read']);
    renderPage();
    await screen.findByText('Canino');

    await userEvent.click(screen.getByRole('button', { name: 'Ver información de Canino' }));

    const dialog = screen.getByRole('dialog', { name: 'Información de la especie' });
    expect(within(dialog).getByText('Canino')).toBeInTheDocument();
    expect(within(dialog).getByText('Perros domésticos')).toBeInTheDocument();
    expect(within(dialog).getByText('Inactiva')).toBeInTheDocument();
  });

  it('actualiza una especie exitosamente y muestra toast de confirmación', async () => {
    permissions = new Set(['species:read', 'species:update']);
    vi.mocked(speciesApi.updateSpecies).mockResolvedValue({
      ...sampleSpecies[0],
      name: 'Canino doméstico',
      description: 'Mascotas caninas',
    });
    const { showToast } = renderPage();
    await screen.findByText('Canino');

    await userEvent.click(screen.getByRole('button', { name: 'Editar Canino' }));
    const dialog = screen.getByRole('dialog');
    const nameInput = within(dialog).getByLabelText(/nombre de la especie/i);
    const descInput = within(dialog).getByLabelText(/descripción/i);

    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Canino doméstico');
    await userEvent.clear(descInput);
    await userEvent.type(descInput, 'Mascotas caninas');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(speciesApi.updateSpecies).toHaveBeenCalledWith('sp-1', {
        name: 'Canino doméstico',
        description: 'Mascotas caninas',
      });
    });
    expect(showToast).toHaveBeenCalledWith('Especie actualizada exitosamente', 'success');
    expect(await screen.findByText('Canino doméstico')).toBeInTheDocument();
  });

  it('permite actualizar una especie dejando la descripción vacía', async () => {
    permissions = new Set(['species:read', 'species:update']);
    vi.mocked(speciesApi.updateSpecies).mockResolvedValue({
      ...sampleSpecies[0],
      description: null,
    });
    renderPage();
    await screen.findByText('Canino');

    await userEvent.click(screen.getByRole('button', { name: 'Editar Canino' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.clear(within(dialog).getByLabelText(/descripción/i));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(speciesApi.updateSpecies).toHaveBeenCalledWith('sp-1', {
        name: 'Canino',
        description: undefined,
      });
    });
  });

  it('impide actualizar si se elimina el nombre de la especie', async () => {
    permissions = new Set(['species:read', 'species:update']);
    renderPage();
    await screen.findByText('Canino');

    await userEvent.click(screen.getByRole('button', { name: 'Editar Canino' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.clear(within(dialog).getByLabelText(/nombre de la especie/i));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));

    expect(within(dialog).getByText('El nombre de la especie es obligatorio')).toBeInTheDocument();
    expect(speciesApi.updateSpecies).not.toHaveBeenCalled();
  });

  it('descarta los cambios al presionar Cancelar', async () => {
    permissions = new Set(['species:read', 'species:update']);
    renderPage();
    await screen.findByText('Canino');

    await userEvent.click(screen.getByRole('button', { name: 'Editar Canino' }));
    const dialog = screen.getByRole('dialog');
    const nameInput = within(dialog).getByLabelText(/nombre de la especie/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Cambio descartado');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(speciesApi.updateSpecies).not.toHaveBeenCalled();
    expect(screen.getByText('Canino')).toBeInTheDocument();
  });
  describe('Activar e inactivar especie (HU-15)', () => {
    const felino: Species = {
      id: 'sp-2',
      name: 'Felino',
      description: null,
      isActive: false,
      createdAt: '2026-11-18T00:00:00.000Z',
      updatedAt: '2026-11-18T00:00:00.000Z',
    };
    const rowOf = (name: string) => screen.getByText(name).closest('tr') as HTMLElement;

    beforeEach(() => {
      vi.mocked(speciesApi.listSpecies).mockResolvedValue([sampleSpecies[0], felino]);
    });

    it('muestra solo Inactivar en las activas y solo Activar en las inactivas (escenario 3)', async () => {
      permissions = new Set(['species:read', 'species:update', 'species:change-status']);
      renderPage();
      await screen.findByText('Canino');

      expect(within(rowOf('Canino')).getByRole('button', { name: 'Inactivar Canino' })).toBeInTheDocument();
      expect(within(rowOf('Canino')).queryByRole('button', { name: 'Activar Canino' })).not.toBeInTheDocument();
      expect(within(rowOf('Felino')).getByRole('button', { name: 'Activar Felino' })).toBeInTheDocument();
      expect(within(rowOf('Felino')).queryByRole('button', { name: 'Inactivar Felino' })).not.toBeInTheDocument();
    });

    it('oculta Activar e Inactivar sin el permiso species:change-status', async () => {
      permissions = new Set(['species:read', 'species:update']);
      renderPage();
      await screen.findByText('Canino');

      expect(screen.queryByRole('button', { name: /^(in)?activar /i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Editar Canino' })).toBeInTheDocument();
    });

    it('muestra la columna de acciones solo con el permiso de estado', async () => {
      permissions = new Set(['species:read', 'species:change-status']);
      renderPage();
      await screen.findByText('Canino');

      expect(screen.getByRole('columnheader', { name: 'Acciones' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Inactivar Canino' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
    });

    it('inactiva una especie tras confirmar, actualiza la fila y avisa (escenario 1)', async () => {
      permissions = new Set(['species:read', 'species:change-status']);
      vi.mocked(speciesApi.changeStatus).mockResolvedValue({ ...sampleSpecies[0], isActive: false });
      const { showToast } = renderPage();
      await screen.findByText('Canino');

      await userEvent.click(screen.getByRole('button', { name: 'Inactivar Canino' }));
      const dialog = screen.getByRole('dialog', { name: 'Inactivar especie' });
      expect(within(dialog).getByText('Canino')).toBeInTheDocument();
      expect(within(dialog).getAllByText(/^(Activa|Inactiva)$/).map((badge) => badge.textContent)).toEqual(['Activa', 'Inactiva']);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }));

      await waitFor(() => expect(speciesApi.changeStatus).toHaveBeenCalledWith('sp-1', false));
      expect(showToast).toHaveBeenCalledWith('Especie inactivada correctamente', 'success');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(within(rowOf('Canino')).getByText('Inactiva')).toBeInTheDocument();
      expect(within(rowOf('Canino')).getByRole('button', { name: 'Activar Canino' })).toBeInTheDocument();
    });

    it('activa una especie tras confirmar, actualiza la fila y avisa (escenario 2)', async () => {
      permissions = new Set(['species:read', 'species:change-status']);
      vi.mocked(speciesApi.changeStatus).mockResolvedValue({ ...felino, isActive: true });
      const { showToast } = renderPage();
      await screen.findByText('Felino');

      await userEvent.click(screen.getByRole('button', { name: 'Activar Felino' }));
      const dialog = screen.getByRole('dialog', { name: 'Activar especie' });
      expect(within(dialog).getAllByText(/^(Activa|Inactiva)$/).map((badge) => badge.textContent)).toEqual(['Inactiva', 'Activa']);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }));

      await waitFor(() => expect(speciesApi.changeStatus).toHaveBeenCalledWith('sp-2', true));
      expect(showToast).toHaveBeenCalledWith('Especie activada correctamente', 'success');
      expect(within(rowOf('Felino')).getByText('Activa')).toBeInTheDocument();
      expect(within(rowOf('Felino')).getByRole('button', { name: 'Inactivar Felino' })).toBeInTheDocument();
    });

    it('cancela con el botón, con Escape o con clic fuera, sin llamar a la API (escenario 5)', async () => {
      permissions = new Set(['species:read', 'species:change-status']);
      renderPage();
      await screen.findByText('Canino');

      await userEvent.click(screen.getByRole('button', { name: 'Inactivar Canino' }));
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Activar Felino' }));
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      // Clic en el fondo, fuera del diálogo.
      await userEvent.click(screen.getByRole('button', { name: 'Inactivar Canino' }));
      fireEvent.mouseDown(screen.getByRole('dialog').parentElement as HTMLElement);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      expect(speciesApi.changeStatus).not.toHaveBeenCalled();
      expect(within(rowOf('Canino')).getByText('Activa')).toBeInTheDocument();
      expect(within(rowOf('Felino')).getByText('Inactiva')).toBeInTheDocument();
    });

    it('deshabilita Confirmar y Cancelar mientras guarda', async () => {
      permissions = new Set(['species:read', 'species:change-status']);
      let finish: (value: Species) => void = () => undefined;
      vi.mocked(speciesApi.changeStatus).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
      renderPage();
      await screen.findByText('Canino');

      await userEvent.click(screen.getByRole('button', { name: 'Inactivar Canino' }));
      const dialog = screen.getByRole('dialog');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }));

      expect(within(dialog).getByRole('button', { name: 'Guardando…' })).toBeDisabled();
      expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toBeDisabled();
      await userEvent.keyboard('{Escape}');
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      finish({ ...sampleSpecies[0], isActive: false });
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('muestra el error de la API en un toast y no cambia la fila', async () => {
      permissions = new Set(['species:read', 'species:change-status']);
      vi.mocked(speciesApi.changeStatus).mockRejectedValue(new Error('Especie no encontrada'));
      const { showToast } = renderPage();
      await screen.findByText('Canino');

      await userEvent.click(screen.getByRole('button', { name: 'Inactivar Canino' }));
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar' }));

      await waitFor(() => expect(showToast).toHaveBeenCalledWith('Especie no encontrada', 'error'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(within(rowOf('Canino')).getByText('Activa')).toBeInTheDocument();
    });
  });
});
