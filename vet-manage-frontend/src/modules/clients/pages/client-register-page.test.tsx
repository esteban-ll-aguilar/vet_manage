import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastContext } from '../../../common/components/toast-context';
import { clientsApi } from '../services/clients-api';
import type { RegisteredClient } from '../types';
import { ClientRegisterPage } from './client-register-page';

vi.mock('../services/clients-api', () => ({
  clientsApi: {
    assignableRoles: vi.fn(),
    register: vi.fn(),
  },
}));

const showToast = vi.fn();
const registeredClient: RegisteredClient = {
  id: 'c1',
  personId: 'p1',
  identification: '1710034065',
  firstName: 'María',
  lastName: 'López',
  email: 'maria@clinica.com',
  phone: '0991234567',
  address: null,
  status: 'ACTIVE',
  roles: [{ name: 'client', displayName: 'Cliente' }],
  existingPerson: false,
  passwordAssigned: true,
  credentialsSent: true,
};

function renderPage() {
  return render(
    <ToastContext.Provider value={{ showToast, dismissToast: vi.fn(), confirm: vi.fn(async () => true) }}>
      <MemoryRouter>
        <ClientRegisterPage />
      </MemoryRouter>
    </ToastContext.Provider>,
  );
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Cédula/), '1710034065');
  await user.type(screen.getByLabelText(/Teléfono/), '0991234567');
  await user.type(screen.getByLabelText(/Nombres/), 'María');
  await user.type(screen.getByLabelText(/Apellidos/), 'López');
  await user.type(screen.getByLabelText(/Correo electrónico/), 'maria@clinica.com');
}

describe('ClientRegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clientsApi.assignableRoles).mockResolvedValue([
      { name: 'client', displayName: 'Cliente', description: 'Dueño del paciente' },
    ]);
    vi.mocked(clientsApi.register).mockResolvedValue(registeredClient);
  });

  it('muestra el teléfono como obligatorio', () => {
    renderPage();

    const phone = screen.getByLabelText(/Teléfono/);
    expect(phone.closest('label')).toHaveTextContent('*');
    expect(phone.closest('label')).not.toHaveTextContent('Opcional');
  });

  it('solo deja escribir números en el teléfono', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/Teléfono/), '09a9b1-23 4567xyz');

    expect(screen.getByLabelText(/Teléfono/)).toHaveValue('0991234567');
  });

  it('resalta el teléfono inválido y muestra el mensaje contractual', async () => {
    const user = userEvent.setup();
    renderPage();

    await fillValidForm(user);
    await user.clear(screen.getByLabelText(/Teléfono/));
    await user.type(screen.getByLabelText(/Teléfono/), '099123456');
    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }));

    await waitFor(() => expect(screen.getByLabelText(/Teléfono/)).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getByText('Por favor, ingrese un correo y número de teléfono válido')).toBeInTheDocument();
    expect(clientsApi.register).not.toHaveBeenCalled();
  });

  it('rechaza un teléfono de 11 dígitos con el mensaje contractual', async () => {
    const user = userEvent.setup();
    renderPage();

    await fillValidForm(user);
    await user.clear(screen.getByLabelText(/Teléfono/));
    await user.type(screen.getByLabelText(/Teléfono/), '09876543210');
    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }));

    await waitFor(() => expect(screen.getByLabelText(/Teléfono/)).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getByText('Por favor, ingrese un correo y número de teléfono válido')).toBeInTheDocument();
    expect(clientsApi.register).not.toHaveBeenCalled();
  });

  it('muestra el mensaje de éxito exacto tras registrar con teléfono válido', async () => {
    const user = userEvent.setup();
    renderPage();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }));

    await waitFor(() => expect(clientsApi.register).toHaveBeenCalledWith({
      identification: '1710034065',
      firstName: 'María',
      lastName: 'López',
      email: 'maria@clinica.com',
      phone: '0991234567',
      address: undefined,
      roles: ['client'],
    }));
    expect(showToast).toHaveBeenCalledWith('Cliente registrado exitosamente', 'success');
  });
});
