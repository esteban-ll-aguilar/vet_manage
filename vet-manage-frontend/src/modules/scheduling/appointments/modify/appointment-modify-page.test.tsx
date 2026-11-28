import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastContext } from '../../../../common/components/toast-context';
import { ApiError } from '../../../../infrastructure/api/http-client';
import { schedulingApi } from '../../services/scheduling-api';
import { AppointmentModifyPage } from './appointment-modify-page';
import { modifyAppointmentApi } from './modify-appointment-api';
import type { AppointmentDetail } from './types';

vi.mock('../../services/scheduling-api', () => ({
  schedulingApi: { listBranches: vi.fn(), listVeterinarians: vi.fn(), listWorkSchedules: vi.fn() },
}));
vi.mock('./modify-appointment-api', () => ({
  modifyAppointmentApi: { detail: vi.fn(), modify: vi.fn() },
}));

const showToast = vi.fn();

const DETAIL: AppointmentDetail = {
  id: 'cita-1',
  numero: 12,
  estado: 'PROGRAMADA',
  modificable: true,
  fecha: '2026-11-02',
  horaInicio: '10:00',
  horaFin: '10:30',
  duracionMin: 30,
  sucursal: { id: 's-loja', nombre: 'Loja' },
  servicio: 'Consulta general',
  paciente: 'Max',
  cliente: { nombre: 'Sofía Herrera', cedula: '1710000082' },
  veterinarioId: 'v-1',
  veterinario: 'Valentina Ruiz',
  salaId: 'r-1',
  sala: 'Consultorio 1',
  importeReserva: '20.00',
  tienePagoAprobado: false,
  cambioHorarioUtilizado: false,
};

function renderPage(detail: Partial<AppointmentDetail> = {}) {
  vi.mocked(modifyAppointmentApi.detail).mockResolvedValue({ ...DETAIL, ...detail });
  return render(
    <ToastContext.Provider value={{ showToast, dismissToast: vi.fn(), confirm: vi.fn(async () => true) }}>
      <MemoryRouter initialEntries={['/appointments/appointments/cita-1/edit']}>
        <Routes>
          <Route path="/appointments/appointments" element={<h1>Lista de citas</h1>} />
          <Route path="/appointments/appointments/:id/edit" element={<AppointmentModifyPage />} />
        </Routes>
      </MemoryRouter>
    </ToastContext.Provider>,
  );
}

const save = () => userEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

describe('AppointmentModifyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(schedulingApi.listBranches).mockResolvedValue([
      {
        id: 's-loja',
        nombre: 'Loja',
        salas: [
          { id: 'r-1', nombre: 'Consultorio 1', tipo: 'CONSULTORIO' },
          { id: 'r-2', nombre: 'Consultorio 2', tipo: 'CONSULTORIO' },
          { id: 'q-1', nombre: 'Quirófano 1', tipo: 'QUIROFANO' },
        ],
      },
      { id: 's-vil', nombre: 'Vilcabamba', salas: [{ id: 'r-9', nombre: 'Consultorio Vilcabamba', tipo: 'CONSULTORIO' }] },
    ]);
    vi.mocked(schedulingApi.listWorkSchedules).mockResolvedValue([
      { id: 'h-1', veterinarioId: 'v-1', veterinarioNombre: 'Valentina Ruiz', sucursalId: 's-loja', sucursalNombre: 'Loja', diaSemana: 'LUNES', horaInicio: '09:00', horaFin: '17:00', estado: true, creadoEn: '', actualizadoEn: '' },
    ]);
    vi.mocked(schedulingApi.listVeterinarians).mockResolvedValue([
      { id: 'v-1', person: { firstName: 'Valentina', lastName: 'Ruiz' } },
      { id: 'v-2', person: { firstName: 'Diego', lastName: 'Reyes' } },
    ]);
  });

  it('muestra los datos que se conservan y precarga el horario y los recursos actuales', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Modificar cita N.° 12' })).toBeInTheDocument();
    expect(screen.getByText('Sofía Herrera · 1710000082')).toBeInTheDocument();
    expect(screen.getByText('02/11/2026 · 10:00–10:30')).toBeInTheDocument();
    expect(screen.getByLabelText(/^fecha/i)).toHaveValue('2026-11-02');
    expect(screen.getByLabelText(/hora de inicio/i)).toHaveValue('10:00');
    expect(screen.getByLabelText(/veterinario/i)).toHaveValue('v-1');
    expect(screen.getByLabelText(/consultorio/i)).toHaveValue('r-1');
  });

  it('muestra la jornada del veterinario para el día elegido', async () => {
    renderPage();

    expect(await screen.findByText('Jornada del veterinario el lunes: 09:00–17:00.')).toBeInTheDocument();
    expect(schedulingApi.listWorkSchedules).toHaveBeenCalledWith({ veterinarioId: 'v-1', sucursalId: 's-loja' });

    fireEvent.change(screen.getByLabelText(/^fecha/i), { target: { value: '2026-11-04' } });
    expect(await screen.findByText('El veterinario no tiene jornada de atención el miércoles en esta sucursal.')).toBeInTheDocument();
  });

  it('solo ofrece los consultorios de la sucursal de la cita', async () => {
    renderPage();

    await screen.findByRole('option', { name: 'Consultorio 2' });
    expect(screen.queryByRole('option', { name: 'Quirófano 1' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Consultorio Vilcabamba' })).not.toBeInTheDocument();
  });

  it('cambia solo el consultorio sin avisar del cambio de horario y vuelve a la lista', async () => {
    vi.mocked(modifyAppointmentApi.modify).mockResolvedValue({} as never);
    renderPage();

    await userEvent.selectOptions(await screen.findByLabelText(/consultorio/i), 'r-2');
    expect(screen.queryByText(/utilizará la única oportunidad/i)).not.toBeInTheDocument();
    await save();

    expect(modifyAppointmentApi.modify).toHaveBeenCalledWith('cita-1', {
      fecha: '2026-11-02',
      horaInicio: '10:00',
      veterinarioId: 'v-1',
      salaId: 'r-2',
    });
    expect(showToast).toHaveBeenCalledWith('Cita modificada correctamente', 'success');
    expect(await screen.findByRole('heading', { name: 'Lista de citas' })).toBeInTheDocument();
  });

  it('al cambiar la hora avisa que se usa la única oportunidad y muestra la nueva hora de fin', async () => {
    vi.mocked(modifyAppointmentApi.modify).mockResolvedValue({} as never);
    renderPage({ estado: 'CONFIRMADA' });

    fireEvent.change(await screen.findByLabelText(/^fecha/i), { target: { value: '2026-11-03' } });
    await userEvent.selectOptions(screen.getByLabelText(/hora de inicio/i), '11:00');

    expect(screen.getByText(/utilizará la única oportunidad de cambio de horario/i)).toBeInTheDocument();
    expect(screen.getByText(/termina a las/i)).toHaveTextContent('Termina a las 11:30');
    await save();

    expect(modifyAppointmentApi.modify).toHaveBeenCalledWith('cita-1', expect.objectContaining({ fecha: '2026-11-03', horaInicio: '11:00' }));
  });

  it('muestra "Veterinario no disponible" si el nuevo horario está ocupado y se queda en el formulario', async () => {
    vi.mocked(modifyAppointmentApi.modify).mockRejectedValue(new ApiError('Veterinario no disponible', 409));
    renderPage();

    await userEvent.selectOptions(await screen.findByLabelText(/hora de inicio/i), '11:00');
    await save();

    expect(await screen.findByText('Veterinario no disponible')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Modificar cita N.° 12' })).toBeInTheDocument();
    expect(showToast).not.toHaveBeenCalled();
  });

  it('una cita que ya no admite cambios muestra el mensaje y no permite guardar', async () => {
    renderPage({ estado: 'FINALIZADA', modificable: false });

    expect(await screen.findByText('El estado de la cita no permite modificaciones')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeDisabled();
    expect(screen.getByLabelText(/consultorio/i)).toBeDisabled();
  });

  it('avisa cuando el cliente ya utilizó su único cambio de horario y muestra el rechazo de la API', async () => {
    vi.mocked(modifyAppointmentApi.modify).mockRejectedValue(
      new ApiError('El cliente ya utilizó su único cambio de horario', 409),
    );
    renderPage({ cambioHorarioUtilizado: true });

    expect(await screen.findByText(/solo puede cambiar el veterinario o el consultorio/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^fecha/i), { target: { value: '2026-11-05' } });
    await save();

    expect(await screen.findAllByText(/el cliente ya utilizó su único cambio de horario/i)).toHaveLength(2);
  });

  it('no envía la solicitud si no hay cambios', async () => {
    renderPage();

    await screen.findByLabelText(/consultorio/i);
    await save();

    expect(screen.getByText('No hay cambios para guardar')).toBeInTheDocument();
    expect(modifyAppointmentApi.modify).not.toHaveBeenCalled();
  });

  it('señala los campos vacíos', async () => {
    renderPage();

    await userEvent.selectOptions(await screen.findByLabelText(/hora de inicio/i), '');
    await userEvent.selectOptions(screen.getByLabelText(/veterinario/i), '');
    await save();

    expect(screen.getByText('Seleccione la hora de inicio')).toBeInTheDocument();
    expect(screen.getByText('Seleccione el veterinario')).toBeInTheDocument();
    expect(modifyAppointmentApi.modify).not.toHaveBeenCalled();
  });

  it('muestra el error si la cita no existe', async () => {
    vi.mocked(modifyAppointmentApi.detail).mockRejectedValue(new ApiError('La cita no existe', 404));
    render(
      <ToastContext.Provider value={{ showToast, dismissToast: vi.fn(), confirm: vi.fn(async () => true) }}>
        <MemoryRouter initialEntries={['/appointments/appointments/x/edit']}>
          <Routes>
            <Route path="/appointments/appointments/:id/edit" element={<AppointmentModifyPage />} />
          </Routes>
        </MemoryRouter>
      </ToastContext.Provider>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('La cita no existe');
  });
});
