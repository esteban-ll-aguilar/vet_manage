import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../../common/components/toast';
import { schedulingApi } from '../services/scheduling-api';
import { WorkSchedulesPage } from './work-schedules-page';

vi.mock('../../auth/auth-context', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}));
vi.mock('../services/scheduling-api', () => ({
  schedulingApi: {
    listWorkSchedules: vi.fn(),
    listBranches: vi.fn(),
    listVeterinarians: vi.fn(),
    deleteWorkSchedule: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(schedulingApi.listWorkSchedules).mockResolvedValue([{
    id: 'horario-1', veterinarioId: 'vet-1', veterinarioNombre: 'Ana Ruiz',
    sucursalId: 'loja', sucursalNombre: 'Loja', diaSemana: 'LUNES',
    horaInicio: '08:00', horaFin: '12:00', estado: true,
    creadoEn: '', actualizadoEn: '',
  }]);
  vi.mocked(schedulingApi.listBranches).mockResolvedValue([]);
  vi.mocked(schedulingApi.listVeterinarians).mockResolvedValue([]);
  vi.mocked(schedulingApi.deleteWorkSchedule).mockResolvedValue(undefined);
});

describe('Confirmación de retiro de horarios', () => {
  it('usa el diálogo de la aplicación y permite cancelar sin eliminar', async () => {
    render(<ToastProvider><WorkSchedulesPage /></ToastProvider>);
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('¿Está seguro de retirar este horario?')).toBeInTheDocument();
    expect(schedulingApi.deleteWorkSchedule).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'No' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(schedulingApi.deleteWorkSchedule).not.toHaveBeenCalled();
  });

  it('retira el horario elegido solo después de confirmar y refresca la lista', async () => {
    render(<ToastProvider><WorkSchedulesPage /></ToastProvider>);
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sí, retirar horario' }));
    await waitFor(() => expect(schedulingApi.deleteWorkSchedule).toHaveBeenCalledWith('horario-1'));
    expect(schedulingApi.deleteWorkSchedule).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(schedulingApi.listWorkSchedules).toHaveBeenCalledTimes(2));
  });
});
