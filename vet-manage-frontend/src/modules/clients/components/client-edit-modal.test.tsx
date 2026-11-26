import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../infrastructure/api/http-client';
import type { ClientListItem, UpdateClientInput } from '../types';
import { ClientEditModal } from './client-edit-modal';

const client = (overrides: Partial<ClientListItem> = {}): ClientListItem => ({
  id: 'c1',
  personId: 'p1',
  identification: '1710034065',
  firstName: 'Carlos',
  lastName: 'Pérez',
  email: 'cperez@correo.com',
  phone: '0991111111',
  address: null,
  status: 'ACTIVE',
  roles: [{ name: 'client', displayName: 'Cliente' }],
  createdAt: '2026-11-19T12:00:00.000Z',
  ...overrides,
});

function setup(overrides: Partial<ClientListItem> = {}, onSubmit: (input: UpdateClientInput) => Promise<void> = vi.fn(async () => undefined)) {
  const onCancel = vi.fn();
  render(<ClientEditModal client={client(overrides)} onSubmit={onSubmit} onCancel={onCancel} />);
  return { onSubmit, onCancel };
}

describe('ClientEditModal', () => {
  it('precarga los datos actuales y bloquea la cédula', () => {
    setup();

    expect(screen.getByLabelText(/cédula/i)).toHaveValue('1710034065');
    expect(screen.getByLabelText(/cédula/i)).toBeDisabled();
    expect(screen.getByLabelText(/nombres/i)).toHaveValue('Carlos');
    expect(screen.getByLabelText(/teléfono/i)).toHaveValue('0991111111');
    expect(screen.getByLabelText(/correo electrónico/i)).toBeEnabled();
  });

  it('bloquea el correo de un cliente que también es personal', () => {
    setup({ roles: [{ name: 'client', displayName: 'Cliente' }, { name: 'manager', displayName: 'Gerente' }] });

    expect(screen.getByLabelText(/correo electrónico/i)).toBeDisabled();
    expect(screen.getByText(/solo el Administrador puede cambiar su correo/i)).toBeInTheDocument();
  });

  it('impide guardar con obligatorios vacíos y los resalta', async () => {
    const { onSubmit } = setup();

    await userEvent.clear(screen.getByLabelText(/nombres/i));
    await userEvent.clear(screen.getByLabelText(/teléfono/i));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Por favor, complete todos los campos obligatorios');
    expect(screen.getByLabelText(/nombres/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/teléfono/i)).toHaveAttribute('aria-invalid', 'true');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rechaza un correo con formato inválido sin llamar a la API', async () => {
    const { onSubmit } = setup();

    await userEvent.clear(screen.getByLabelText(/correo electrónico/i));
    await userEvent.type(screen.getByLabelText(/correo electrónico/i), 'carlos@');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Por favor, ingrese un correo y número de teléfono válido');
    expect(screen.getByLabelText(/correo electrónico/i)).toHaveAttribute('aria-invalid', 'true');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('solo deja escribir números en el teléfono', async () => {
    setup();

    await userEvent.clear(screen.getByLabelText(/teléfono/i));
    await userEvent.type(screen.getByLabelText(/teléfono/i), '09a9b2-22 2222xyz');

    expect(screen.getByLabelText(/teléfono/i)).toHaveValue('0992222222');
  });

  it('no recorta un teléfono de 11 dígitos: muestra el mensaje sin llamar a la API', async () => {
    const { onSubmit } = setup();

    await userEvent.clear(screen.getByLabelText(/teléfono/i));
    await userEvent.type(screen.getByLabelText(/teléfono/i), '09876543210');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));

    expect(screen.getByLabelText(/teléfono/i)).toHaveValue('09876543210');
    expect(screen.getByLabelText(/teléfono/i)).toHaveAttribute('aria-invalid', 'true');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('envía los datos sin la cédula', async () => {
    const { onSubmit } = setup();

    await userEvent.clear(screen.getByLabelText(/teléfono/i));
    await userEvent.type(screen.getByLabelText(/teléfono/i), '0992222222');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));

    expect(onSubmit).toHaveBeenCalledWith({
      firstName: 'Carlos', lastName: 'Pérez', email: 'cperez@correo.com', phone: '0992222222', address: '',
    });
  });

  it('deshabilita los botones mientras guarda', async () => {
    let finish: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    setup({}, vi.fn(() => pending));

    await userEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));

    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    finish();
  });

  it('muestra el rechazo de la API en el campo del correo', async () => {
    const onSubmit = vi.fn(async () => {
      throw new ApiError('El correo de este cliente también es el de su cuenta del personal', 409, {
        code: 'CLIENT_EMAIL_LOCKED', errors: ['email'],
      });
    });
    setup({}, onSubmit);

    await userEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El correo de este cliente también es el de su cuenta del personal');
    expect(screen.getByLabelText(/correo electrónico/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Guardar Cambios' })).toBeEnabled();
  });

  it('cancela con el botón y con Escape', async () => {
    const { onCancel } = setup();

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await userEvent.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
