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
vi.mock('../services/patient.service', () => ({ patientApi: { registerPatient: vi.fn(), searchActiveClients: vi.fn() } }));

let canCreate = true;
vi.mock('../../auth/auth-context', () => ({ useAuth: () => ({ hasPermission: () => canCreate }) }));

const showToast = vi.fn();

function renderPage() {
  return render(
    <ToastContext.Provider value={{ showToast, dismissToast: vi.fn() }}>
      <PatientsPage />
    </ToastContext.Provider>,
  );
}

describe('PatientsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canCreate = true;
    vi.mocked(speciesApi.listActiveSpecies).mockResolvedValue([{ id: 'sp-1', name: 'Canino' }]);
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
});
