import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../infrastructure/api/http-client';
import { AuthContext, type AuthContextValue } from '../../auth/auth-context';
import type { SessionProfile } from '../../auth/types';
import { schedulingApi } from '../services/scheduling-api';
import { ratesApi } from './rates-api';
import {
  FORBIDDEN_RATE_MESSAGE,
  INVALID_RATE_MESSAGE,
  REQUIRED_RATE_MESSAGE,
  RatesPage,
} from './rates-page';

vi.mock('../services/scheduling-api', () => ({
  schedulingApi: {
    listBranches: vi.fn(),
  },
}));

vi.mock('./rates-api', () => ({
  ratesApi: {
    listServices: vi.fn(),
    list: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    deactivateService: vi.fn(),
    activateService: vi.fn(),
  },
}));

function makeRate(id: string, amount: number, active = true) {
  return {
    id,
    servicioId: 'service-consulta',
    sucursalId: 'branch-loja',
    importe: amount,
    fechaVigencia: '2026-11-20T00:00:00.000Z',
    estado: active,
    servicio: { id: 'service-consulta', nombre: 'Consulta general', estado: true },
    sucursal: { id: 'branch-loja', nombre: 'Loja', estado: true },
  };
}

function renderPage(
  canRead = true,
  canManage = true,
  user: SessionProfile['user'] = {
    id: 'staff',
    firstName: 'Ana',
    lastName: 'Admin',
    email: 'admin@example.test',
    roles: [],
    permissions: [],
  },
) {
  const permissions = canManage
    ? ['rates:read', 'rates:manage']
    : canRead
      ? ['rates:read']
      : [];
  const session = { mustChangePassword: false, user };
  const auth: AuthContextValue = {
    status: 'authenticated',
    session,
    login: vi.fn(async () => session),
    logout: vi.fn(async () => undefined),
    hasPermission: (permission) => permissions.includes(permission),
  };
  return render(<AuthContext.Provider value={auth}><RatesPage /></AuthContext.Provider>);
}

async function submitAmount(value?: string) {
  renderPage();
  const user = userEvent.setup();
  await screen.findByRole('option', { name: 'Consulta general' });
  const input = await screen.findByRole('spinbutton', { name: 'Tarifa USD' });
  if (value !== undefined) await user.type(input, value);
  await user.click(screen.getByRole('button', { name: 'Guardar' }));
  return input;
}

describe('RatesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(schedulingApi.listBranches).mockResolvedValue([
      { id: 'branch-loja', nombre: 'Loja', salas: [] },
    ]);
    vi.mocked(ratesApi.listServices).mockResolvedValue([
      { id: 'service-consulta', nombre: 'Consulta general', duracionMaximaMin: 30, estado: true },
    ]);
    vi.mocked(ratesApi.list).mockResolvedValue([]);
  });

  it('CP-025-04 muestra debajo del campo el mensaje exacto para tarifa cero', async () => {
    const input = await submitAmount('0');
    const field = input.closest('label');
    expect(field).not.toBeNull();
    expect(within(field as HTMLElement).getByRole('alert')).toHaveTextContent(INVALID_RATE_MESSAGE);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('min', '0');
    expect(input).toHaveAttribute('step', '0.01');
  });

  it('CP-025-05 muestra debajo del campo el mensaje exacto para tarifa negativa', async () => {
    const input = await submitAmount('-5.00');
    expect(within(input.closest('label') as HTMLElement).getByRole('alert'))
      .toHaveTextContent(INVALID_RATE_MESSAGE);
  });

  it('CP-025-06 usa un campo numérico para impedir texto libre', async () => {
    renderPage();
    const input = await screen.findByRole('spinbutton', { name: 'Tarifa USD' });
    expect(input).toHaveAttribute('type', 'number');
  });

  it('CP-025-06 valida texto inválido mediante la validación del formulario', async () => {
    renderPage();
    await screen.findByRole('option', { name: 'Consulta general' });
    const input = await screen.findByRole('spinbutton', { name: 'Tarifa USD' });
    fireEvent.change(input, { target: { value: '' } });
    Object.defineProperty(input, 'validity', { configurable: true, value: { badInput: true } });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Guardar' }));
    expect(within(input.closest('label') as HTMLElement).getByRole('alert'))
      .toHaveTextContent(INVALID_RATE_MESSAGE);
  });

  it('CP-025-07 muestra debajo del campo el mensaje exacto para tres decimales', async () => {
    const input = await submitAmount('20.005');
    expect(within(input.closest('label') as HTMLElement).getByRole('alert'))
      .toHaveTextContent(INVALID_RATE_MESSAGE);
  });

  it('CP-025-08 muestra debajo del campo el mensaje exacto para tarifa vacía', async () => {
    const input = await submitAmount();
    expect(within(input.closest('label') as HTMLElement).getByRole('alert'))
      .toHaveTextContent(REQUIRED_RATE_MESSAGE);
  });

  it('CP-025-01 registra y muestra la tarifa vigente de USD 20.00', async () => {
    const user = userEvent.setup();
    vi.mocked(ratesApi.save).mockResolvedValue(makeRate('rate-20', 20));
    renderPage();

    await screen.findByRole('option', { name: 'Consulta general' });
    await user.type(await screen.findByRole('spinbutton', { name: 'Tarifa USD' }), '20.00');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(ratesApi.save).toHaveBeenCalledWith({
      servicioId: 'service-consulta',
      sucursalId: 'branch-loja',
      importe: 20,
    });
    const table = await screen.findByRole('table', { name: 'Tarifas' });
    expect(within(table).getByRole('columnheader', { name: 'Sucursal' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: 'USD 20.00' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: 'Activa' })).toBeInTheDocument();
  });

  it('CP-025-02 crea una tarifa vigente nueva sin reemplazar el historial local', async () => {
    const user = userEvent.setup();
    vi.mocked(ratesApi.list).mockResolvedValue([makeRate('rate-20', 20)]);
    vi.mocked(ratesApi.update).mockResolvedValue(makeRate('rate-25', 25));
    renderPage();

    await screen.findByRole('option', { name: 'Consulta general' });
    await user.type(await screen.findByRole('spinbutton', { name: 'Tarifa USD' }), '25.00');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(ratesApi.update).toHaveBeenCalledWith('rate-20', 25);
    expect(await screen.findByRole('cell', { name: 'USD 25.00' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Activa' })).toBeInTheDocument();
  });

  it('CP-025-03 mantiene el servicio y sus citas/tarifas visibles al inactivarlo', async () => {
    const user = userEvent.setup();
    vi.mocked(ratesApi.list).mockResolvedValue([makeRate('rate-20', 20)]);
    vi.mocked(ratesApi.deactivateService).mockResolvedValue({
      id: 'service-consulta',
      nombre: 'Consulta general',
      estado: false,
    });
    renderPage();

    const serviceOption = await screen.findByRole('option', { name: 'Consulta general' });
    await user.click(await screen.findByRole('button', { name: 'Inactivar servicio' }));

    expect(ratesApi.deactivateService).toHaveBeenCalledWith('service-consulta');
    expect(await screen.findByRole('cell', { name: 'USD 20.00' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Inactiva' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Activar servicio' })).toBeInTheDocument();
    expect(serviceOption).toBeInTheDocument();
    expect(serviceOption).not.toBeDisabled();
  });

  it('CP-025-03 reactiva un servicio y lo conserva disponible en el selector', async () => {
    const user = userEvent.setup();
    vi.mocked(ratesApi.listServices).mockResolvedValue([
      { id: 'service-consulta', nombre: 'Consulta general', duracionMaximaMin: 30, estado: true },
      { id: 'service-vacunacion', nombre: 'Vacunación', duracionMaximaMin: 30, estado: false },
    ]);
    vi.mocked(ratesApi.activateService).mockResolvedValue({
      id: 'service-vacunacion',
      nombre: 'Vacunación',
      estado: true,
    });
    vi.mocked(ratesApi.list).mockResolvedValue([
      {
        ...makeRate('rate-vacunacion', 18),
        servicioId: 'service-vacunacion',
        servicio: { id: 'service-vacunacion', nombre: 'Vacunación', estado: false },
      },
    ]);
    renderPage();

    const inactiveOption = await screen.findByRole('option', { name: 'Vacunación' });
    expect(inactiveOption).not.toBeDisabled();
    const serviceRow = screen.getByRole('row', { name: /Vacunación/ });
    await user.click(within(serviceRow).getByRole('button', { name: 'Activar servicio' }));

    expect(ratesApi.activateService).toHaveBeenCalledWith('service-vacunacion');
    const updatedRow = screen.getByRole('row', { name: /Vacunación/ });
    expect(within(updatedRow).getByRole('button', { name: 'Inactivar servicio' })).toBeInTheDocument();
    expect(within(updatedRow).getByRole('cell', { name: 'Activa' })).toBeInTheDocument();
    expect(inactiveOption).not.toBeDisabled();
  });

  it('permite seleccionar un servicio inactivo y asignarle tarifa sin cambiar su estado', async () => {
    const user = userEvent.setup();
    vi.mocked(ratesApi.listServices).mockResolvedValue([
      { id: 'service-consulta', nombre: 'Consulta general', duracionMaximaMin: 30, estado: true },
      { id: 'service-vacunacion', nombre: 'Vacunación', duracionMaximaMin: 30, estado: false },
    ]);
    vi.mocked(ratesApi.save).mockResolvedValue({
      ...makeRate('rate-vacunacion', 20),
      servicioId: 'service-vacunacion',
      servicio: { id: 'service-vacunacion', nombre: 'Vacunación', estado: false },
    });
    renderPage();

    await user.selectOptions(await screen.findByLabelText('Servicio'), 'service-vacunacion');
    await user.type(await screen.findByRole('spinbutton', { name: 'Tarifa USD' }), '20.00');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(ratesApi.save).toHaveBeenCalledWith({
      servicioId: 'service-vacunacion',
      sucursalId: 'branch-loja',
      importe: 20,
    });
    const row = screen.getByRole('row', { name: /Vacunación/ });
    expect(within(row).getByRole('cell', { name: 'Inactiva' })).toBeInTheDocument();
    expect(within(row).getByRole('cell', { name: 'USD 20.00' })).toBeInTheDocument();
  });

  it('CP-025-01 muestra tarifas de todos los servicios y sucursales al cargar desde la API', async () => {
    vi.mocked(schedulingApi.listBranches).mockResolvedValue([
      { id: 'branch-loja', nombre: 'Loja', salas: [] },
      { id: 'branch-centro', nombre: 'Sucursal Centro', salas: [] },
    ]);
    vi.mocked(ratesApi.listServices).mockResolvedValue([
      { id: 'service-consulta', nombre: 'Consulta general', duracionMaximaMin: 30, estado: true },
      { id: 'service-vacunacion', nombre: 'Vacunación', duracionMaximaMin: 30, estado: false },
    ]);
    vi.mocked(ratesApi.list).mockResolvedValue([
      makeRate('rate-consulta', 25),
      {
        ...makeRate('rate-vacunacion', 18, false),
        servicioId: 'service-vacunacion',
        servicio: { id: 'service-vacunacion', nombre: 'Vacunación', estado: false },
      },
    ]);

    renderPage();

    expect(await screen.findAllByRole('cell', { name: 'Consulta general' })).not.toHaveLength(0);
    expect(screen.getAllByRole('cell', { name: 'Vacunación' })).not.toHaveLength(0);
    expect(screen.getAllByRole('cell', { name: 'Loja' })).not.toHaveLength(0);
    expect(screen.getAllByRole('cell', { name: 'Sucursal Centro' })).not.toHaveLength(0);
    expect(screen.getByRole('cell', { name: 'USD 25.00' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'USD 18.00' })).toBeInTheDocument();
  });

  it('CP-025-09 sin rates:manage oculta todos los controles de cambios', async () => {
    renderPage(true, false, {
      id: 'seed-receptionist',
      firstName: 'Lucía',
      lastName: 'Mendoza',
      email: 'recepcion@vetmanage.local',
      roles: [{ name: 'receptionist', displayName: 'Recepcionista' }],
      permissions: ['rates:read'],
    });

    expect(await screen.findByText('Tarifas')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Inactivar servicio' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Activar servicio' })).not.toBeInTheDocument();
    expect(ratesApi.update).not.toHaveBeenCalled();
    expect(ratesApi.deactivateService).not.toHaveBeenCalled();
    expect(ratesApi.activateService).not.toHaveBeenCalled();
  });

  it('CP-025-09 muestra el permiso denegado ante un 403 y conserva el catálogo', async () => {
    const user = userEvent.setup();
    vi.mocked(ratesApi.list).mockResolvedValue([makeRate('rate-20', 20)]);
    vi.mocked(ratesApi.update).mockRejectedValue(new ApiError('Forbidden', 403));
    renderPage();

    await screen.findByRole('option', { name: 'Consulta general' });
    await user.type(await screen.findByRole('spinbutton', { name: 'Tarifa USD' }), '25.00');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText(FORBIDDEN_RATE_MESSAGE)).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'USD 20.00' })).toBeInTheDocument();
  });

  it('CP-025-09 muestra acceso denegado sin rates:read', () => {
    renderPage(false, false);
    expect(screen.getByRole('alert')).toHaveTextContent(FORBIDDEN_RATE_MESSAGE);
  });
});
