import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../../common/components/toast';
import { schedulingApi } from '../services/scheduling-api';
import { SaturdayShiftsPage } from './saturday-shifts-page';

vi.mock('../../auth/auth-context', () => ({ useAuth: () => ({ hasPermission: () => true }) }));
vi.mock('../services/scheduling-api', () => ({ schedulingApi: {
  listSaturdayShifts: vi.fn(), listBranches: vi.fn(), listVeterinarians: vi.fn(), generateSaturdayShifts: vi.fn(),
} }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(schedulingApi.listSaturdayShifts).mockResolvedValue([]);
  vi.mocked(schedulingApi.listBranches).mockResolvedValue([{ id: 'loja', nombre: 'Loja', salas: [] }]);
  vi.mocked(schedulingApi.listVeterinarians).mockResolvedValue([
    { id: 'vet-1', person: { firstName: 'Ana', lastName: 'Ruiz' } },
    { id: 'vet-2', person: { firstName: 'Luis', lastName: 'Paz' } },
  ]);
  vi.mocked(schedulingApi.generateSaturdayShifts).mockResolvedValue([]);
});

describe('Selección de veterinarios para sábados', () => {
  it('permite elegir por nombre, evita duplicados y envía los IDs en el orden elegido', async () => {
    render(<ToastProvider><SaturdayShiftsPage /></ToastProvider>);
    await screen.findByRole('option', { name: 'Loja' });
    await userEvent.selectOptions(screen.getByLabelText('Sucursal'), 'loja');
    const selector = screen.getByLabelText('Veterinarios de la rotación');
    await userEvent.selectOptions(selector, 'vet-2');
    expect(within(selector).queryByRole('option', { name: 'Luis Paz' })).not.toBeInTheDocument();
    await userEvent.selectOptions(selector, 'vet-1');
    const items = within(screen.getByRole('list', { name: 'Orden de rotación' })).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Luis Paz');
    expect(items[1]).toHaveTextContent('Ana Ruiz');
    await userEvent.click(screen.getByRole('button', { name: 'Generar y guardar' }));
    await waitFor(() => expect(schedulingApi.generateSaturdayShifts).toHaveBeenCalledWith({
      sucursalId: 'loja', fechas: ['2026-11-07', '2026-11-14', '2026-11-21'], veterinarioIds: ['vet-2', 'vet-1'],
    }));
  });

  it('permite quitar un veterinario y bloquea la generación sin seleccionados', async () => {
    render(<ToastProvider><SaturdayShiftsPage /></ToastProvider>);
    await screen.findByRole('option', { name: 'Loja' });
    await userEvent.selectOptions(screen.getByLabelText('Sucursal'), 'loja');
    const selector = screen.getByLabelText('Veterinarios de la rotación');
    await userEvent.selectOptions(selector, 'vet-1');
    await userEvent.click(screen.getByRole('button', { name: 'Quitar a Ana Ruiz de la rotación' }));
    expect(within(selector).getByRole('option', { name: 'Ana Ruiz' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Orden de rotación' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Generar y guardar' }));
    expect(schedulingApi.generateSaturdayShifts).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Sucursal y veterinarios elegibles son obligatorios.');
  });
});
