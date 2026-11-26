import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastContext } from '../../../common/components/toast-context';
import { schedulingApi } from '../services/scheduling-api';
import { blocksApi } from './blocks-api';
import { BlocksPage } from './blocks-page';
import type { ScheduleBlock } from './types';

vi.mock('../services/scheduling-api', () => ({ schedulingApi: { listBranches: vi.fn() } }));
vi.mock('./blocks-api', () => ({ blocksApi: { list: vi.fn(), listVeterinarians: vi.fn(), create: vi.fn(), remove: vi.fn() } }));

let permissions = new Set(['schedule-blocks:read', 'schedule-blocks:remove']);
vi.mock('../../auth/auth-context', () => ({ useAuth: () => ({ hasPermission: (key: string) => permissions.has(key) }) }));

const showToast = vi.fn();

const block: ScheduleBlock = {
  id: 'b-1',
  sucursal: { id: 's-1', nombre: 'Loja' },
  alcance: 'VETERINARIO',
  veterinario: { id: 'v-1', nombre: 'Valentina Ruiz' },
  fecha: '2026-11-03',
  horaInicio: '09:00',
  horaFin: '09:30',
  motivo: 'Permiso médico',
  registradoPor: 'Marcelo Paredes',
  creadoEn: '2026-11-01T08:00:00.000Z',
};

function renderPage() {
  return render(
      <ToastContext.Provider value={{ showToast, dismissToast: vi.fn(), confirm: vi.fn(async () => true) }}>
      <MemoryRouter><BlocksPage /></MemoryRouter>
    </ToastContext.Provider>,
  );
}

async function removeFirstBlock() {
  await userEvent.click(await screen.findByRole('button', { name: /eliminar el bloqueo/i }));
  await userEvent.click(screen.getByRole('button', { name: /sí, eliminar/i }));
}

describe('BlocksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissions = new Set(['schedule-blocks:read', 'schedule-blocks:remove']);
    vi.mocked(schedulingApi.listBranches).mockResolvedValue([]);
    vi.mocked(blocksApi.listVeterinarians).mockResolvedValue([]);
    vi.mocked(blocksApi.list).mockResolvedValueOnce([block]).mockResolvedValue([]);
  });

  it('elimina el bloqueo, avisa y vuelve a cargar la lista sin él', async () => {
    vi.mocked(blocksApi.remove).mockResolvedValue({ id: 'b-1', fechaEliminacion: '2026-11-02T15:00:00.000Z' });
    renderPage();

    await removeFirstBlock();

    expect(blocksApi.remove).toHaveBeenCalledWith('b-1');
    expect(showToast).toHaveBeenCalledWith('Bloqueo eliminado correctamente', 'success');
    expect(await screen.findByText('No hay bloqueos vigentes')).toBeInTheDocument();
    expect(blocksApi.list).toHaveBeenCalledTimes(2);
  });

  it('si ya fue eliminado muestra "El bloqueo ya no existe" y actualiza la lista', async () => {
    vi.mocked(blocksApi.remove).mockRejectedValue(new Error('El bloqueo ya no existe'));
    renderPage();

    await removeFirstBlock();

    expect(showToast).toHaveBeenCalledWith('El bloqueo ya no existe', 'error');
    await waitFor(() => expect(blocksApi.list).toHaveBeenCalledTimes(2));
    expect(blocksApi.remove).toHaveBeenCalledTimes(1);
  });

  it('sin permiso para eliminar, la lista no muestra el botón', async () => {
    permissions = new Set(['schedule-blocks:read']);
    renderPage();

    expect(await screen.findByText('Permiso médico')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /eliminar el bloqueo/i })).not.toBeInTheDocument();
  });

  it('quien puede registrar ve el botón Nuevo bloqueo que lleva al formulario', async () => {
    permissions = new Set(['schedule-blocks:read', 'schedule-blocks:create']);
    renderPage();

    expect(await screen.findByRole('link', { name: /nuevo bloqueo/i })).toHaveAttribute('href', '/appointments/blocks/new');
    expect(screen.queryByRole('button', { name: /registrar bloqueo/i })).not.toBeInTheDocument();
  });

  it('sin permiso para registrar no muestra el botón Nuevo bloqueo', async () => {
    permissions = new Set(['schedule-blocks:read']);
    renderPage();

    expect(await screen.findByText('Permiso médico')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /nuevo bloqueo/i })).not.toBeInTheDocument();
  });
});
