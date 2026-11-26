import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BlocksTable } from './blocks-table';
import type { ScheduleBlock } from './types';

const block = (id: string, horaInicio: string, horaFin: string): ScheduleBlock => ({
  id,
  sucursal: { id: 's-1', nombre: 'Loja' },
  alcance: 'VETERINARIO',
  veterinario: { id: 'v-1', nombre: 'Valentina Ruiz' },
  fecha: '2026-11-03',
  horaInicio,
  horaFin,
  motivo: 'Permiso médico',
  registradoPor: 'Marcelo Paredes',
  creadoEn: '2026-11-01T08:00:00.000Z',
});

// Dos bloqueos que afectan al mismo veterinario y horario.
const blocks = [block('b-1', '09:00', '09:30'), block('b-2', '09:00', '09:30')];

function setup(canRemove = true, onRemove = vi.fn<(item: ScheduleBlock) => Promise<void>>(async () => undefined)) {
  render(<BlocksTable blocks={blocks} canRemove={canRemove} onRemove={onRemove} />);
  return onRemove;
}

describe('BlocksTable', () => {
  it('muestra los bloqueos con su fecha, horario y alcance', () => {
    setup();

    expect(screen.getAllByText('03/11/2026')).toHaveLength(2);
    expect(screen.getAllByText('09:00–09:30')).toHaveLength(2);
  });

  it('pide confirmación y elimina solo el bloqueo elegido', async () => {
    const onRemove = setup();

    await userEvent.click(screen.getAllByRole('button', { name: /eliminar el bloqueo/i })[0]);
    expect(onRemove).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /sí, eliminar/i }));

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith(blocks[0]);
  });

  it('al cancelar la confirmación no elimina nada', async () => {
    const onRemove = setup();

    await userEvent.click(screen.getAllByRole('button', { name: /eliminar el bloqueo/i })[1]);
    await userEvent.click(screen.getByRole('button', { name: /^no$/i }));

    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.getAllByRole('button', { name: /eliminar el bloqueo/i })).toHaveLength(2);
  });

  it('sin permiso para eliminar no muestra el botón', () => {
    setup(false);

    expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument();
  });
});
