import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ExpirationAlertsPanel } from './expiration-alerts-panel';
import type { ExpirationAlert } from '../types';

const alerts: ExpirationAlert[] = [
  {
    lotId: 'lot-001',
    productName: 'Vacuna antirrábica',
    lotCode: 'LOTE-001',
    expirationDate: '2026-12-19',
    availableQuantity: 10,
    status: 'UPCOMING',
    label: 'Próximo a caducar',
  },
  {
    lotId: 'lot-002',
    productName: 'Antibiótico',
    lotCode: 'LOTE-002',
    expirationDate: '2026-11-18',
    availableQuantity: 5,
    status: 'EXPIRED',
    label: 'Caducado',
  },
];

describe('ExpirationAlertsPanel', () => {
  it('shows the requested empty-state message after a successful empty response', () => {
    render(<ExpirationAlertsPanel alerts={[]} state="success" />);

    expect(screen.getByText('No hay lotes próximos a caducar ni caducados')).toBeInTheDocument();
  });

  it('shows product, lot, expiry, units, and both alert labels', () => {
    render(<ExpirationAlertsPanel alerts={alerts} state="success" />);

    expect(screen.getByRole('table', { name: 'Alertas de caducidad' })).toBeInTheDocument();
    expect(screen.getByText('Vacuna antirrábica')).toBeInTheDocument();
    expect(screen.getByText('LOTE-001')).toBeInTheDocument();
    expect(screen.getByText('2026-12-19')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Próximo a caducar')).toBeInTheDocument();
    expect(screen.getByText('Caducado')).toBeInTheDocument();
  });

  it('lets a Bodeguero save a new expiry date from an alert row', async () => {
    const onRefresh = vi.fn();
    const onSaveExpiration = vi.fn().mockImplementation(async () => onRefresh());
    render(
      <ExpirationAlertsPanel
        alerts={[alerts[0]]}
        state="success"
        canEdit
        onRefresh={onRefresh}
        onSaveExpiration={onSaveExpiration}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Editar caducidad de LOTE-001' }));
    fireEvent.change(screen.getByLabelText('Nueva fecha de caducidad para LOTE-001'), {
      target: { value: '2027-01-03' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onSaveExpiration).toHaveBeenCalledWith('lot-001', '2027-01-03');
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('announces loading and errors separately from the empty state and allows refresh', async () => {
    const onRefresh = vi.fn();
    const { rerender } = render(<ExpirationAlertsPanel alerts={[]} state="loading" onRefresh={onRefresh} />);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando alertas de caducidad');

    rerender(<ExpirationAlertsPanel alerts={[]} state="error" onRefresh={onRefresh} />);
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron cargar las alertas de caducidad.');
    expect(screen.queryByText('No hay lotes próximos a caducar ni caducados')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});
