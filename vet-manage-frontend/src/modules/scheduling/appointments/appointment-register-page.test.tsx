import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { clientsApi } from '../../clients/services/clients-api';
import { schedulingApi } from '../services/scheduling-api';
import { ratesApi } from '../rates/rates-api';
import { AppointmentRegisterPage } from './appointment-register-page';
import { AppointmentRegisterRoute } from './appointment-register-route';

vi.mock('../../clients/services/clients-api', () => ({
  clientsApi: { list: vi.fn(), pets: vi.fn() },
}));
vi.mock('../services/scheduling-api', () => ({
  schedulingApi: {
    listBranches: vi.fn(),
    listServices: vi.fn(),
    listVeterinarians: vi.fn(),
    listWorkSchedules: vi.fn(),
    registerAppointment: vi.fn(),
  },
}));
vi.mock('../rates/rates-api', () => ({
  ratesApi: { list: vi.fn() },
}));

const validAppointment = {
  branch: {
    id: 'branch-1',
    nombre: 'Loja',
    salas: [{ id: 'room-1', nombre: 'Consultorio 1', tipo: 'CONSULTORIO' as const }],
  },
  client: {
    id: 'client-1',
    personId: 'person-1',
    identification: '1100000000',
    firstName: 'María',
    lastName: 'López',
    email: 'maria@example.test',
    phone: null,
    address: null,
    status: 'ACTIVE' as const,
    roles: [],
    createdAt: '2030-01-01T00:00:00.000Z',
  },
  patient: {
    id: 'patient-1',
    code: 'P-001',
    name: 'Luna',
    species: 'Canina',
    breed: 'Mestiza',
    status: 'ACTIVE' as const,
  },
  service: { id: 'service-1', nombre: 'Consulta general', duracionMaximaMin: 60 },
  veterinarian: { id: 'vet-1', person: { firstName: 'Ana', lastName: 'Veterinaria' } },
};

function configureValidForm() {
  vi.mocked(schedulingApi.listWorkSchedules).mockResolvedValue([]);
  vi.mocked(schedulingApi.listBranches).mockResolvedValue([validAppointment.branch]);
  vi.mocked(schedulingApi.listServices).mockResolvedValue([validAppointment.service]);
  vi.mocked(schedulingApi.listVeterinarians).mockResolvedValue([validAppointment.veterinarian]);
  vi.mocked(clientsApi.list).mockResolvedValue({
    items: [validAppointment.client],
    total: 1,
    page: 1,
    pageSize: 100,
    totalPages: 1,
  });
  vi.mocked(clientsApi.pets).mockResolvedValue([validAppointment.patient]);
  vi.mocked(ratesApi.list).mockResolvedValue([{
    id: 'rate-1',
    servicioId: validAppointment.service.id,
    sucursalId: validAppointment.branch.id,
    importe: '20',
    fechaVigencia: '2030-01-01T00:00:00.000Z',
    estado: true,
    servicio: { id: validAppointment.service.id, nombre: validAppointment.service.nombre, estado: true },
    sucursal: { id: validAppointment.branch.id, nombre: validAppointment.branch.nombre, estado: true },
  }]);
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByLabelText('Sucursal *');
  await user.selectOptions(screen.getByLabelText('Sucursal *'), validAppointment.branch.id);
  await user.selectOptions(screen.getByLabelText('Cliente *'), validAppointment.client.id);
  await screen.findByRole('option', { name: /Luna · P-001/ });
  await user.selectOptions(screen.getByLabelText('Paciente *'), validAppointment.patient.id);
  await user.selectOptions(screen.getByLabelText('Servicio *'), validAppointment.service.id);
  await user.selectOptions(screen.getByLabelText('Veterinario *'), validAppointment.veterinarian.id);
  await user.selectOptions(screen.getByLabelText('Consultorio *'), 'room-1');
  fireEvent.change(screen.getByLabelText('Fecha *'), { target: { value: '2030-01-02' } });
  fireEvent.change(screen.getByLabelText('Hora de inicio *'), { target: { value: '10:00' } });
  fireEvent.change(screen.getByLabelText('Duración (minutos) *'), { target: { value: '60' } });
}

describe('AppointmentRegisterPage', () => {
  beforeEach(() => {
    vi.mocked(schedulingApi.listBranches).mockResolvedValue([]);
    vi.mocked(schedulingApi.listServices).mockResolvedValue([]);
    vi.mocked(schedulingApi.listVeterinarians).mockResolvedValue([]);
    vi.mocked(clientsApi.list).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 100,
      totalPages: 0,
    });
    vi.mocked(ratesApi.list).mockResolvedValue([]);
    vi.mocked(schedulingApi.registerAppointment).mockReset();
  });

  it('CP-001-03 recibe sucursal, fecha y hora del calendario sin registrar automaticamente', async () => {
    configureValidForm();
    render(
      <MemoryRouter initialEntries={['/appointments/appointments/new?sucursalId=branch-1&fecha=2030-01-02&horaInicio=09%3A00']}>
        <AppointmentRegisterRoute />
      </MemoryRouter>,
    );
    expect(await screen.findByLabelText('Sucursal *')).toHaveValue('branch-1');
    expect(screen.getByLabelText('Fecha *')).toHaveValue('2030-01-02');
    expect(screen.getByLabelText('Hora de inicio *')).toHaveValue('09:00');
    expect(screen.getByLabelText('Cliente *')).toHaveValue('');
    expect(schedulingApi.registerAppointment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar cita' }));
    expect(schedulingApi.registerAppointment).not.toHaveBeenCalled();
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
  });

  it('bloquea el registro y señala cada campo obligatorio vacío', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AppointmentRegisterPage onBack={vi.fn()} />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole('button', { name: 'Registrar cita' }));

    expect(screen.getAllByRole('alert')).toHaveLength(9);
    expect(schedulingApi.registerAppointment).not.toHaveBeenCalled();
  });

  it('registra una cita de 60 minutos y muestra el número, el estado y la confirmación', async () => {
    configureValidForm();
    vi.mocked(schedulingApi.registerAppointment).mockResolvedValue({
      id: 'appointment-1',
      numero: 1201,
      fechaHora: '2030-01-02T15:00:00.000Z',
      fechaHoraFin: '2030-01-02T16:00:00.000Z',
      estado: 'PROGRAMADA',
      importeReserva: '20',
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AppointmentRegisterPage onBack={vi.fn()} />
      </MemoryRouter>,
    );

    await fillValidForm(user);
    await screen.findByText(/20(?:,|\.)00/);
    await user.click(screen.getByRole('button', { name: 'Registrar cita' }));

    expect(await screen.findByText('Cita registrada')).toBeTruthy();
    expect(screen.getByText('Número: 1201')).toBeTruthy();
    expect(screen.getByText('Estado: Programada')).toBeTruthy();
    expect(schedulingApi.registerAppointment).toHaveBeenCalledWith({
      sucursalId: 'branch-1',
      clienteId: 'client-1',
      pacienteId: 'patient-1',
      servicioId: 'service-1',
      veterinarioId: 'vet-1',
      salaId: 'room-1',
      fecha: '2030-01-02',
      horaInicio: '10:00',
      duracionMin: 60,
    });
  });

  it('ofrece horas y duraciones en períodos de 30 minutos', async () => {
    configureValidForm();
    render(
      <MemoryRouter>
        <AppointmentRegisterPage onBack={vi.fn()} />
      </MemoryRouter>,
    );

    const hour = await screen.findByLabelText('Hora de inicio *');
    expect(hour.tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: '10:30' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '10:15' })).not.toBeInTheDocument();

    await userEvent.selectOptions(await screen.findByLabelText('Servicio *'), validAppointment.service.id);
    expect(screen.getByRole('option', { name: '30 minutos' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '60 minutos' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '90 minutos' })).not.toBeInTheDocument();
  });

  it.each([
    'Veterinario no disponible',
    'Consultorio no disponible',
    'Horario bloqueado',
    'La fecha y hora deben ser posteriores al momento actual',
    'El paciente no pertenece al cliente',
    'La duración debe ser de al menos 30 minutos y no superar el máximo permitido para el servicio',
  ])('muestra sin alterar el mensaje del backend: %s', async (message) => {
    configureValidForm();
    vi.mocked(schedulingApi.registerAppointment).mockRejectedValue(
      new Error(message),
    );
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AppointmentRegisterPage onBack={vi.fn()} />
      </MemoryRouter>,
    );

    await fillValidForm(user);
    await screen.findByText(/20(?:,|\.)00/);
    await user.click(screen.getByRole('button', { name: 'Registrar cita' }));

    expect((await screen.findByRole('alert')).textContent).toBe(message);
  });

  it('explica cuando la sucursal o el cliente no tienen opciones activas', async () => {
    configureValidForm();
    vi.mocked(schedulingApi.listBranches).mockResolvedValue([
      { ...validAppointment.branch, salas: [] },
    ]);
    vi.mocked(clientsApi.pets).mockResolvedValue([]);
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AppointmentRegisterPage onBack={vi.fn()} />
      </MemoryRouter>,
    );

    await screen.findByLabelText('Sucursal *');
    await user.selectOptions(screen.getByLabelText('Sucursal *'), validAppointment.branch.id);
    await user.selectOptions(screen.getByLabelText('Cliente *'), validAppointment.client.id);

    expect(await screen.findByRole('option', {
      name: 'Este cliente no tiene pacientes activos',
    })).toBeTruthy();
    expect(screen.getByLabelText('Paciente *')).toBeDisabled();
    expect(screen.getByRole('option', {
      name: 'Esta sucursal no tiene consultorios activos',
    })).toBeTruthy();
    expect(screen.getByLabelText('Consultorio *')).toBeDisabled();
  });
});
