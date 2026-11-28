import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppointmentsTable } from './appointments-table';
import type { Appointment, AppointmentStatus } from './types';

const appointment = (numero: number, estado: AppointmentStatus): Appointment => ({
  id: `cita-${numero}`,
  numero,
  estado,
  fechaHora: '2026-11-02T15:00:00.000Z',
  fechaHoraFin: '2026-11-02T15:30:00.000Z',
  paciente: 'Max',
  sucursal: 'Loja',
  sala: 'Consultorio 1',
  veterinario: 'Valentina Ruiz',
  tienePagoAprobado: false,
});

const appointments = [
  appointment(1, 'PROGRAMADA'),
  appointment(2, 'CONFIRMADA'),
  appointment(3, 'EN_CURSO'),
  appointment(4, 'FINALIZADA'),
  appointment(5, 'CANCELADA'),
  appointment(6, 'NO_ASISTIO'),
];

function renderTable(canModify: boolean, canCancel = false) {
  return render(
    <MemoryRouter>
      <AppointmentsTable appointments={appointments} canCancel={canCancel} canModify={canModify} onCancel={vi.fn()} />
    </MemoryRouter>,
  );
}

describe('AppointmentsTable - Modificar', () => {
  it('solo ofrece Modificar en citas Programadas y Confirmadas', () => {
    renderTable(true);

    expect(screen.getByRole('link', { name: 'Modificar cita 1' })).toHaveAttribute('href', '/appointments/appointments/cita-1/edit');
    expect(screen.getByRole('link', { name: 'Modificar cita 2' })).toBeInTheDocument();
    for (const numero of [3, 4, 5, 6]) {
      expect(screen.queryByRole('link', { name: `Modificar cita ${numero}` })).not.toBeInTheDocument();
    }
  });

  it('sin el permiso no muestra Modificar', () => {
    renderTable(false, true);

    expect(screen.queryByRole('link', { name: /modificar cita/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar cita 1' })).toBeInTheDocument();
  });

  it('ofrece Cancelar en citas Programadas y Confirmadas, no en las demás', () => {
    renderTable(false, true);

    expect(screen.getByRole('button', { name: 'Cancelar cita 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar cita 2' })).toBeInTheDocument();
    for (const numero of [3, 4, 5, 6]) {
      expect(screen.queryByRole('button', { name: `Cancelar cita ${numero}` })).not.toBeInTheDocument();
    }
  });

  it('sin permisos de modificar ni cancelar no muestra la columna de acciones', () => {
    renderTable(false, false);

    expect(screen.queryByRole('columnheader', { name: 'Acciones' })).not.toBeInTheDocument();
  });
});
