import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ClientListItem } from '../types';
import { ClientDeactivateModal } from './client-deactivate-modal';

const client: ClientListItem = {
  id: 'c1',
  personId: 'p1',
  identification: '1105017030',
  firstName: 'Pedro',
  lastName: 'Castillo',
  email: 'pedro@correo.test',
  phone: null,
  address: null,
  status: 'INACTIVE',
  roles: [],
  createdAt: '2026-11-19T12:00:00.000Z',
};

function renderModal(onConfirm = vi.fn(async () => undefined), onCancel = vi.fn()) {
  render(<ClientDeactivateModal client={client} onConfirm={onConfirm} onCancel={onCancel} />);
  return { onConfirm, onCancel, reason: screen.getByLabelText(/motivo de la baja/i) };
}

describe('ClientDeactivateModal (HU-03)', () => {
  // Positivos
  it('muestra el cliente, la transición Inactivo → De baja y el aviso de acción definitiva', () => {
    renderModal();
    const dialog = screen.getByRole('dialog', { name: 'Dar de baja cliente' });
    expect(dialog).toHaveTextContent('Pedro Castillo');
    expect(dialog).toHaveTextContent('Inactivo');
    expect(dialog).toHaveTextContent('De baja');
    expect(dialog).toHaveTextContent(/la baja es definitiva/i);
  });

  it('confirma con el motivo sin espacios exteriores', async () => {
    const { onConfirm, reason } = renderModal();
    await userEvent.type(reason, '  Se mudó de ciudad  ');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar baja' }));
    expect(onConfirm).toHaveBeenCalledWith('Se mudó de ciudad');
  });

  it('Cancelar cierra sin confirmar', async () => {
    const { onConfirm, onCancel, reason } = renderModal();
    await userEvent.type(reason, 'Motivo');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Escape cierra sin confirmar', async () => {
    const { onConfirm, onCancel } = renderModal();
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // Negativos
  it.each([['vacío', ''], ['solo con espacios', '   ']])('no confirma con el motivo %s y lo resalta', async (_, value) => {
    const { onConfirm, reason } = renderModal();
    if (value) await userEvent.type(reason, value);
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar baja' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText('Ingrese el motivo de la baja')).toBeInTheDocument();
    expect(reason).toHaveAttribute('aria-invalid', 'true');
  });

  it('si la API rechaza la baja, muestra su mensaje y el modal sigue abierto', async () => {
    const onConfirm = vi.fn(async () => {
      throw new Error('El cliente está desactivado');
    });
    const { reason } = renderModal(onConfirm);
    await userEvent.type(reason, 'Motivo');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar baja' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El cliente está desactivado');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar baja' })).toBeEnabled());
  });

  // Valor límite
  it('acepta un motivo de 1 carácter', async () => {
    const { onConfirm, reason } = renderModal();
    await userEvent.type(reason, 'X');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar baja' }));
    expect(onConfirm).toHaveBeenCalledWith('X');
  });

  it('muestra el contador y no admite más de 500 caracteres', () => {
    const { reason } = renderModal();
    fireEvent.change(reason, { target: { value: 'm'.repeat(501) } });

    expect(reason).toHaveValue('m'.repeat(500));
    expect(screen.getByText('500/500')).toBeInTheDocument();
  });
});
