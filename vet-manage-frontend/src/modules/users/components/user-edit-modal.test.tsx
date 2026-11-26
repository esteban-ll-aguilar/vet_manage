import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../infrastructure/api/http-client';
import type { UpdateUserInput, UserDetail } from '../types';
import { UserEditModal } from './user-edit-modal';

const user = (overrides: Partial<UserDetail> = {}): UserDetail => ({
  id: 'u1',
  identification: '1710034065',
  firstName: 'Carlos',
  lastName: 'Pérez',
  email: 'cperez@correo.com',
  phone: '0991111111',
  status: 'ACTIVE',
  roles: [{ name: 'veterinarian', displayName: 'Veterinario' }],
  ...overrides,
});

function setup(
  onSubmit: (input: UpdateUserInput) => Promise<void> = vi.fn(async () => undefined),
  options: { readOnly?: boolean; user?: UserDetail } = {},
) {
  const onClose = vi.fn();
  render(<UserEditModal user={options.user ?? user()} readOnly={options.readOnly} onSubmit={onSubmit} onClose={onClose} />);
  return { onSubmit, onClose };
}

describe('UserEditModal', () => {
  it('precarga los datos actuales y bloquea la cédula (escenario 6)', () => {
    setup();

    expect(screen.getByLabelText(/cédula/i)).toHaveValue('1710034065');
    expect(screen.getByLabelText(/cédula/i)).toBeDisabled();
    expect(screen.getByLabelText(/nombres/i)).toHaveValue('Carlos');
    expect(screen.getByLabelText(/teléfono/i)).toHaveValue('0991111111');
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
  });

  it('impide guardar con el nombre vacío (escenario 5)', async () => {
    const { onSubmit } = setup();

    await userEvent.clear(screen.getByLabelText(/nombres/i));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Complete los campos obligatorios');
    expect(screen.getByLabelText(/nombres/i)).toHaveAttribute('aria-invalid', 'true');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each([[/correo electrónico/i, 'carlos@'], [/teléfono/i, '0991']])(
    'señala el campo %s con "Formato no válido" (escenario 4)',
    async (label, value) => {
      const { onSubmit } = setup();

      await userEvent.clear(screen.getByLabelText(label));
      await userEvent.type(screen.getByLabelText(label), value);
      await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

      expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getAllByText('Formato no válido').length).toBeGreaterThan(0);
      expect(onSubmit).not.toHaveBeenCalled();
    },
  );

  it('solo deja escribir números en el teléfono y limita la longitud de cada campo', async () => {
    setup();

    await userEvent.clear(screen.getByLabelText(/teléfono/i));
    await userEvent.type(screen.getByLabelText(/teléfono/i), '09a9b2-22 2222xyz');

    expect(screen.getByLabelText(/teléfono/i)).toHaveValue('0992222222');
    expect(screen.getByLabelText(/teléfono/i)).toHaveAttribute('maxLength', '16');
    expect(screen.getByLabelText(/nombres/i)).toHaveAttribute('maxLength', '100');
    expect(screen.getByLabelText(/apellidos/i)).toHaveAttribute('maxLength', '100');
    expect(screen.getByLabelText(/correo electrónico/i)).toHaveAttribute('maxLength', '255');
  });

  it('envía los datos sin la cédula', async () => {
    const { onSubmit } = setup();

    await userEvent.clear(screen.getByLabelText(/teléfono/i));
    await userEvent.type(screen.getByLabelText(/teléfono/i), '0992222222');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onSubmit).toHaveBeenCalledWith({ firstName: 'Carlos', lastName: 'Pérez', email: 'cperez@correo.com', phone: '0992222222' });
  });

  it('deshabilita los botones mientras guarda', async () => {
    let finish: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    setup(vi.fn(() => pending));

    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    finish();
  });

  it('muestra el correo repetido que rechaza la API (escenario 3)', async () => {
    setup(vi.fn(async () => {
      throw new ApiError('El correo ya se encuentra registrado', 409, { code: 'USER_EMAIL_TAKEN', errors: ['email'] });
    }));

    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El correo ya se encuentra registrado');
    expect(screen.getByLabelText(/correo electrónico/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
  });

  it('cancela con el botón y con Escape (escenario 7)', async () => {
    const { onClose, onSubmit } = setup();

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await userEvent.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('muestra la ficha de solo lectura sin opción de editar (escenario 8)', () => {
    setup(undefined, {
      readOnly: true,
      user: user({
        status: 'DEACTIVATED',
        deactivatedAt: '2026-11-26T10:00:00.000Z',
        deactivationReason: 'Renuncia',
      }),
    });

    expect(screen.getByRole('dialog', { name: 'Datos del usuario' })).toBeInTheDocument();
    for (const label of [/cédula/i, /teléfono/i, /nombres/i, /apellidos/i, /correo electrónico/i, /fecha de baja/i, /motivo de la baja/i]) {
      expect(screen.getByLabelText(label)).toBeDisabled();
    }
    expect(screen.getByLabelText(/motivo de la baja/i)).toHaveValue('Renuncia');
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
    expect(screen.getByText(/dado de baja/i)).toBeInTheDocument();
  });
});
