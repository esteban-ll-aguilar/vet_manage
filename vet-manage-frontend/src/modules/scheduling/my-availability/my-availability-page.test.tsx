import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastContext } from '../../../common/components/toast-context';
import { ApiError } from '../../../infrastructure/api/http-client';
import { schedulingApi } from '../services/scheduling-api';
import type { MyAvailability, MyAvailabilityJornada } from '../types';
import { MyAvailabilityPage } from './my-availability-page';

vi.mock('../services/scheduling-api', () => ({
  schedulingApi: {
    getMyAvailability: vi.fn(),
    saveMyAvailability: vi.fn(),
    resetMyAvailability: vi.fn(),
  },
}));

const showToast = vi.fn();

const loja: MyAvailabilityJornada = {
  horarioBaseId: 'base-1',
  sucursalId: 'suc-1',
  sucursalNombre: 'Loja',
  horaInicio: '08:00',
  horaFin: '12:00',
  franjas: [{ id: 'franja-1', horaInicio: '08:00', horaFin: '11:00' }],
};

const vilcabamba: MyAvailabilityJornada = {
  ...loja,
  horarioBaseId: 'base-2',
  sucursalId: 'suc-2',
  sucursalNombre: 'Vilcabamba',
  horaInicio: '09:00',
  horaFin: '13:00',
  franjas: [],
};

function availability(jornadas: MyAvailabilityJornada[]): MyAvailability {
  return { fecha: '2026-11-02', diaSemana: 'LUNES', jornadas };
}

function renderPage() {
  return render(
    <ToastContext.Provider value={{ showToast, dismissToast: vi.fn(), confirm: vi.fn(async () => true) }}>
      <MyAvailabilityPage />
    </ToastContext.Provider>,
  );
}

describe('MyAvailabilityPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(schedulingApi.getMyAvailability).mockResolvedValue(availability([loja]));
  });

  it('muestra la jornada autorizada y sus franjas', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Mi disponibilidad diaria' })).toBeInTheDocument();
    expect(screen.getByText('Jornada autorizada: 08:00–12:00 · Loja')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Franjas disponibles' })).toHaveTextContent('08:00');
  });

  it('permite elegir entre varias jornadas del día', async () => {
    vi.mocked(schedulingApi.getMyAvailability).mockResolvedValue(availability([loja, vilcabamba]));
    renderPage();

    const jornadaSelect = await screen.findByLabelText('Jornada');
    expect(jornadaSelect).toHaveTextContent('Loja · 08:00–12:00');
    expect(jornadaSelect).toHaveTextContent('Vilcabamba · 09:00–13:00');

    await userEvent.selectOptions(jornadaSelect, 'base-2');

    expect(screen.getByText('Jornada autorizada: 09:00–13:00 · Vilcabamba')).toBeInTheDocument();
    expect(screen.getByText('Sin franjas: se usa toda la jornada autorizada.')).toBeInTheDocument();
  });

  it('muestra el mensaje cuando no existe horario base', async () => {
    vi.mocked(schedulingApi.getMyAvailability).mockRejectedValue(
      new ApiError('No existe horario base para la fecha', 400),
    );
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('No existe horario base para la fecha');
  });

  it('agrega una franja y guarda la disponibilidad completa', async () => {
    vi.mocked(schedulingApi.saveMyAvailability).mockResolvedValue(availability([loja]));
    renderPage();

    await screen.findByRole('table', { name: 'Franjas disponibles' });
    await userEvent.selectOptions(screen.getByLabelText('Hora de inicio'), '11:00');
    await userEvent.selectOptions(screen.getByLabelText('Hora de fin'), '12:00');
    await userEvent.click(screen.getByRole('button', { name: 'Agregar franja' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar disponibilidad' }));

    expect(schedulingApi.saveMyAvailability).toHaveBeenCalledWith({
      fecha: expect.any(String),
      horarioBaseId: 'base-1',
      franjas: [
        { horaInicio: '08:00', horaFin: '11:00' },
        { horaInicio: '11:00', horaFin: '12:00' },
      ],
    });
    expect(showToast).toHaveBeenCalledWith('Disponibilidad guardada correctamente', 'success');
  });

  it('no agrega una franja fuera de la jornada autorizada', async () => {
    renderPage();

    await screen.findByRole('table', { name: 'Franjas disponibles' });
    await userEvent.selectOptions(screen.getByLabelText('Hora de inicio'), '08:00');
    await userEvent.selectOptions(screen.getByLabelText('Hora de fin'), '13:00');
    await userEvent.click(screen.getByRole('button', { name: 'Agregar franja' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La disponibilidad diaria debe estar dentro del horario base',
    );
    expect(screen.getByRole('table', { name: 'Franjas disponibles' })).not.toHaveTextContent('13:00');
  });

  it('muestra las citas afectadas cuando el cambio deja una fuera de horario', async () => {
    vi.mocked(schedulingApi.saveMyAvailability).mockRejectedValue(
      new ApiError('El cambio afecta una cita existente', 409, {
        errors: ['Cita #12 · 11:00–11:30 · CONFIRMADA · Firulais · Consultorio 1 · Loja'],
      }),
    );
    renderPage();

    await screen.findByRole('table', { name: 'Franjas disponibles' });
    // Se agrega una franja que tampoco se debe conservar si el guardado falla.
    await userEvent.selectOptions(screen.getByLabelText('Hora de inicio'), '11:30');
    await userEvent.selectOptions(screen.getByLabelText('Hora de fin'), '12:00');
    await userEvent.click(screen.getByRole('button', { name: 'Agregar franja' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar disponibilidad' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('El cambio afecta una cita existente');
    expect(alert).toHaveTextContent('Cita #12');
    expect(showToast).not.toHaveBeenCalledWith('Disponibilidad guardada correctamente', 'success');
    // Vuelve a mostrarse el horario guardado, no el intento rechazado.
    expect(screen.getByRole('table', { name: 'Franjas disponibles' })).not.toHaveTextContent('11:30');
  });

  it('restablece la jornada y quita las franjas', async () => {
    vi.mocked(schedulingApi.resetMyAvailability).mockResolvedValue(
      availability([{ ...loja, franjas: [] }]),
    );
    vi.mocked(schedulingApi.getMyAvailability)
      .mockResolvedValueOnce(availability([loja]))
      .mockResolvedValue(availability([{ ...loja, franjas: [] }]));
    renderPage();

    await screen.findByRole('table', { name: 'Franjas disponibles' });
    await userEvent.click(screen.getByRole('button', { name: 'Restablecer jornada' }));

    expect(schedulingApi.resetMyAvailability).toHaveBeenCalledWith(expect.any(String), 'base-1');
    expect(showToast).toHaveBeenCalledWith('Jornada restablecida', 'success');
    expect(await screen.findByText('Sin franjas: se usa toda la jornada autorizada.')).toBeInTheDocument();
  });
});
