import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastContext } from '../../../common/components/toast-context';
import { schedulingApi } from '../services/scheduling-api';
import { BlockRegisterPage } from './block-register-page';
import { blocksApi } from './blocks-api';

vi.mock('../services/scheduling-api', () => ({ schedulingApi: { listBranches: vi.fn() } }));
vi.mock('./blocks-api', () => ({ blocksApi: { listVeterinarians: vi.fn(), create: vi.fn() } }));

const showToast = vi.fn();

function renderPage() {
  return render(
      <ToastContext.Provider value={{ showToast, dismissToast: vi.fn(), confirm: vi.fn(async () => true) }}>
      <MemoryRouter initialEntries={['/appointments/blocks/new']}>
        <Routes>
          <Route path="/appointments/blocks" element={<h1>Lista de bloqueos</h1>} />
          <Route path="/appointments/blocks/new" element={<BlockRegisterPage />} />
        </Routes>
      </MemoryRouter>
    </ToastContext.Provider>,
  );
}

async function fillAndSubmit() {
  await userEvent.selectOptions(await screen.findByLabelText(/^sucursal/i), 's-1');
  await userEvent.click(screen.getByLabelText(/toda la sucursal/i));
  fireEvent.change(screen.getByLabelText(/^fecha/i), { target: { value: '2026-11-03' } });
  await userEvent.selectOptions(screen.getByLabelText(/hora de inicio/i), '12:00');
  await userEvent.selectOptions(screen.getByLabelText(/hora de fin/i), '13:00');
  await userEvent.type(screen.getByLabelText(/motivo/i), 'Mantenimiento');
  await userEvent.click(screen.getByRole('button', { name: /registrar bloqueo/i }));
}

describe('BlockRegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(schedulingApi.listBranches).mockResolvedValue([{ id: 's-1', nombre: 'Loja', salas: [] }]);
    vi.mocked(blocksApi.listVeterinarians).mockResolvedValue([{ id: 'v-1', nombre: 'Valentina Ruiz' }]);
  });

  it('carga las sucursales y los veterinarios en el formulario', async () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Registrar bloqueo' })).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'Loja' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Valentina Ruiz' })).toBeInTheDocument();
  });

  it('al registrar avisa y vuelve a la lista de bloqueos', async () => {
    vi.mocked(blocksApi.create).mockResolvedValue({} as never);
    renderPage();

    await fillAndSubmit();

    expect(blocksApi.create).toHaveBeenCalledWith({
      sucursalId: 's-1', alcance: 'SUCURSAL', fecha: '2026-11-03', horaInicio: '12:00', horaFin: '13:00', motivo: 'Mantenimiento',
    });
    expect(showToast).toHaveBeenCalledWith('Bloqueo registrado correctamente', 'success');
    expect(await screen.findByRole('heading', { name: 'Lista de bloqueos' })).toBeInTheDocument();
  });

  it('si el bloqueo afecta una cita se queda en el formulario y muestra la cita', async () => {
    vi.mocked(blocksApi.create).mockRejectedValue(Object.assign(new Error('El bloqueo afecta una cita existente'), {
      errors: ['Cita N.° 12 · 03/11/2026 12:30–13:00 · Paciente Luna · Valentina Ruiz · Consultorio 1'],
    }));
    renderPage();

    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Cita N.° 12');
    expect(screen.getByRole('heading', { name: 'Registrar bloqueo' })).toBeInTheDocument();
    expect(showToast).not.toHaveBeenCalledWith('Bloqueo registrado correctamente', 'success');
  });

  it('Cancelar y Volver llevan a la lista de bloqueos', async () => {
    renderPage();

    expect(screen.getByRole('link', { name: /cancelar/i })).toHaveAttribute('href', '/appointments/blocks');
    await userEvent.click(screen.getByRole('link', { name: /volver a bloqueos/i }));
    expect(await screen.findByRole('heading', { name: 'Lista de bloqueos' })).toBeInTheDocument();
  });
});
