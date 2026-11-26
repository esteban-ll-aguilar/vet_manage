import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastContext } from '../../../common/components/toast-context';
import { PatientsPage } from './patients-page';
import { speciesApi } from '../services/species.service';
import { breedApi } from '../services/breed.service';
import { patientApi } from '../services/patient.service';

vi.mock('../services/species.service', () => ({ speciesApi: { listActiveSpecies: vi.fn() } }));
vi.mock('../services/breed.service', () => ({ breedApi: { listActiveBreeds: vi.fn() } }));
vi.mock('../services/patient.service', () => ({
  patientApi: { registerPatient: vi.fn(), searchActiveClients: vi.fn(), searchPatients: vi.fn() },
}));

let canCreate = true;
vi.mock('../../auth/auth-context', () => ({ useAuth: () => ({ hasPermission: () => canCreate }) }));

const showToast = vi.fn();

const firulais = {
  id: 'pt-1',
  code: 'PAC-000001',
  name: 'Firulais',
  gender: 'MALE' as const,
  birthDate: '10-05-2024',
  weightKg: 12.5,
  heightCm: 45,
  reproductiveStatus: 'STERILIZED' as const,
  color: 'Café',
  status: 'ACTIVE' as const,
  client: { identification: '0961441234', firstName: 'Ana', lastName: 'Pérez' },
  species: { id: 'sp-1', name: 'Canino' },
  breed: { id: 'br-1', name: 'Labrador' },
};

const patientPage = (overrides: Record<string, unknown> = {}) => ({
  items: [firulais],
  total: 1,
  page: 1,
  pageSize: 20,
  totalPages: 1,
  ...overrides,
});

function renderPage() {
  return render(
      <ToastContext.Provider value={{ showToast, dismissToast: vi.fn(), confirm: vi.fn(async () => true) }}>
      <PatientsPage />
    </ToastContext.Provider>,
  );
}

describe('PatientsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canCreate = true;
    vi.mocked(speciesApi.listActiveSpecies).mockResolvedValue([{ id: 'sp-1', name: 'Canino' }]);
    vi.mocked(patientApi.searchPatients).mockResolvedValue(patientPage({ items: [], total: 0, totalPages: 0 }));
  });

  it('abre el registro en un modal con las especies activas', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /nuevo paciente/i }));

    expect(screen.getByRole('dialog', { name: /datos del paciente/i })).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'Canino' })).toBeInTheDocument();
  });

  it('cierra el modal con Escape y con Cancelar', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /nuevo paciente/i }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /nuevo paciente/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cierra el modal y muestra el toast de éxito al registrar', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(breedApi.listActiveBreeds).mockResolvedValue([{ id: 'br-1', name: 'Labrador' }]);
    vi.mocked(patientApi.searchActiveClients).mockResolvedValue([
      { id: 'cl-1', identification: '1710034065', firstName: 'María', lastName: 'López' },
    ]);
    vi.mocked(patientApi.registerPatient).mockResolvedValue({ code: 'PAC-000007' } as never);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();

    await user.click(screen.getByRole('button', { name: /nuevo paciente/i }));
    await screen.findByRole('option', { name: 'Canino' });
    await user.type(screen.getByLabelText(/^nombre/i), 'Firulais');
    await user.selectOptions(screen.getByLabelText(/especie/i), 'sp-1');
    await screen.findByRole('option', { name: 'Labrador' });
    await user.selectOptions(screen.getByLabelText(/raza/i), 'br-1');
    await user.selectOptions(screen.getByLabelText(/sexo/i), 'MALE');
    await user.type(screen.getByLabelText(/fecha de nacimiento/i), '10052024');
    await user.type(screen.getByLabelText(/peso/i), '12');
    await user.type(screen.getByLabelText(/talla/i), '40');
    await user.selectOptions(screen.getByLabelText(/estado reproductivo/i), 'UNKNOWN');
    await user.type(screen.getByLabelText(/cliente/i), 'María');
    await user.click(await screen.findByRole('button', { name: /maría lópez/i }));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(showToast).toHaveBeenCalledWith('Paciente registrado exitosamente', 'success');
    vi.useRealTimers();
  });

  it('oculta el botón sin el permiso pets:create', () => {
    canCreate = false;
    renderPage();

    expect(screen.queryByRole('button', { name: /nuevo paciente/i })).not.toBeInTheDocument();
  });

  it('reemplaza el placeholder por la tabla con el listado inicial', async () => {
    vi.mocked(patientApi.searchPatients).mockResolvedValue(patientPage());
    renderPage();

    expect(await screen.findByRole('table', { name: /pacientes/i })).toBeInTheDocument();
    expect(screen.queryByText(/próximamente/i)).not.toBeInTheDocument();
    expect(screen.getByText('PAC-000001')).toBeInTheDocument();
    expect(screen.getByText('Canino · Labrador')).toBeInTheDocument();
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
  });

  it('busca con el término ingresado y reinicia la página', async () => {
    vi.mocked(patientApi.searchPatients).mockResolvedValue(patientPage());
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('table', { name: /pacientes/i });

    await user.type(screen.getByLabelText(/buscar pacientes/i), ' jos ');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() => expect(patientApi.searchPatients).toHaveBeenLastCalledWith({
      search: 'jos', page: 1, pageSize: 20,
    }));
  });

  it('valida un término de un carácter sin ejecutar la búsqueda', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(patientApi.searchPatients).toHaveBeenCalledTimes(1));

    await user.type(screen.getByLabelText(/buscar pacientes/i), 'a');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ingrese al menos 2 caracteres para buscar por nombre o el código del paciente',
    );
    expect(patientApi.searchPatients).toHaveBeenCalledTimes(1);
  });

  it('muestra el mensaje de sin resultados', async () => {
    vi.mocked(patientApi.searchPatients).mockResolvedValue(patientPage({ items: [], total: 0, totalPages: 0 }));
    renderPage();

    expect(await screen.findByText('No se encontraron pacientes que coincidan con la búsqueda')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: /pacientes/i })).not.toBeInTheDocument();
  });

  it('navega a la página siguiente conservando el término', async () => {
    vi.mocked(patientApi.searchPatients).mockImplementation(async (query) => patientPage({
      page: query?.page ?? 1,
      total: 40,
      totalPages: 2,
    }));
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('button', { name: 'Siguiente' });

    await user.type(screen.getByLabelText(/buscar pacientes/i), 'ana');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(patientApi.searchPatients).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'ana' }),
    ));

    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    await waitFor(() => expect(patientApi.searchPatients).toHaveBeenLastCalledWith({
      search: 'ana', page: 2, pageSize: 20,
    }));
    expect(await screen.findByText('Página 2 de 2')).toBeInTheDocument();
  });

  it('limpia la búsqueda y vuelve al listado completo', async () => {
    vi.mocked(patientApi.searchPatients).mockResolvedValue(patientPage());
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('table', { name: /pacientes/i });

    const input = screen.getByLabelText(/buscar pacientes/i);
    await user.type(input, 'ana');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(patientApi.searchPatients).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'ana' }),
    ));

    await user.click(screen.getByRole('button', { name: /limpiar búsqueda/i }));

    expect(input).toHaveValue('');
    await waitFor(() => expect(patientApi.searchPatients).toHaveBeenLastCalledWith({
      page: 1, pageSize: 20,
    }));
  });

  it('abre la ficha de solo lectura al seleccionar un paciente', async () => {
    vi.mocked(patientApi.searchPatients).mockResolvedValue(patientPage());
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('button', { name: 'Firulais' });

    await user.click(screen.getByRole('button', { name: 'Firulais' }));

    expect(await screen.findByRole('dialog', { name: /ficha de firulais/i })).toBeInTheDocument();
    expect(screen.getByText('0961441234')).toBeInTheDocument();
    expect(screen.getByText('10-05-2024')).toBeInTheDocument();
    expect(screen.getByText('Esterilizado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /nuevo paciente/i })).toBeInTheDocument();
  });

  it('cierra la ficha y conserva la tabla y la búsqueda', async () => {
    vi.mocked(patientApi.searchPatients).mockResolvedValue(patientPage());
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('button', { name: 'Firulais' });

    await user.click(screen.getByRole('button', { name: 'Firulais' }));
    await screen.findByRole('dialog', { name: /ficha de firulais/i });
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(screen.queryByRole('dialog', { name: /ficha de firulais/i })).not.toBeInTheDocument();
    expect(screen.getByRole('table', { name: /pacientes/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/buscar pacientes/i)).toBeInTheDocument();
  });
});
