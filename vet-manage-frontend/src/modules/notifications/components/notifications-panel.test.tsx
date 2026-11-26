import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { NotificationsPanel } from './notifications-panel';
import type { Notification } from '../types';

const notification: Notification = {
  id: '22222222-2222-4222-8222-222222222222',
  type: { code: 'LOW_STOCK', name: 'Inventario' },
  tipoEntidad: 'PRODUCT',
  entidadId: '33333333-3333-4333-8333-333333333333',
  titulo: 'Stock bajo',
  mensaje: 'El producto está por debajo del mínimo',
  detalle: 'Quedan 3 unidades',
  prioridad: 'ALTA',
  fechaEmitida: '2026-11-19T10:00:00.000Z',
  fechaLectura: null,
  leida: false,
};

const readNotification: Notification = {
  ...notification,
  leida: true,
  fechaLectura: '2026-11-19T11:00:00.000Z',
};

function renderPanel(overrides: Partial<ComponentProps<typeof NotificationsPanel>> = {}) {
  const props: ComponentProps<typeof NotificationsPanel> = {
    state: 'success',
    notifications: [notification],
    unreadCount: 1,
    onRetry: vi.fn(),
    onClose: vi.fn(),
    onMarkAsRead: vi.fn().mockResolvedValue(undefined),
    onOpenRelated: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  const view = render(<NotificationsPanel {...props} />);
  return { ...view, props };
}

describe('NotificationsPanel', () => {
  it('shows title, date, read state, detail and related record', async () => {
    const { container } = renderPanel();

    expect(screen.getByRole('heading', { name: 'Notificaciones' })).toBeInTheDocument();
    expect(screen.getByText('Stock bajo')).toBeInTheDocument();
    expect(screen.getByText('No leída')).toBeInTheDocument();
    expect(screen.getByText('El producto está por debajo del mínimo')).toBeInTheDocument();
    expect(screen.getByText('ALTA')).toBeInTheDocument();

    const time = container.querySelector('time');
    expect(time).not.toBeNull();
    expect(time).toHaveAttribute('datetime', '2026-11-19T10:00:00.000Z');
    expect(screen.getByRole('button', { name: 'Abrir registro relacionado de "Stock bajo"' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Ver detalle de "Stock bajo"' }));
    expect(screen.getByText('Quedan 3 unidades')).toBeInTheDocument();
  });

  it('marks a notification as read without removing it from the history', async () => {
    const { props, rerender } = renderPanel();

    await userEvent.click(screen.getByRole('button', { name: 'Marcar "Stock bajo" como leída' }));

    expect(props.onMarkAsRead).toHaveBeenCalledWith(notification);
    expect(screen.getByText('Stock bajo')).toBeInTheDocument();

    rerender(
      <NotificationsPanel
        {...props}
        notifications={[readNotification]}
        unreadCount={0}
      />,
    );

    expect(screen.getByText('Leída')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Marcar "Stock bajo" como leída' })).not.toBeInTheDocument();
    expect(screen.getByText('Stock bajo')).toBeInTheDocument();
  });

  it('opens the related record', async () => {
    const { props } = renderPanel();

    await userEvent.click(screen.getByRole('button', { name: 'Abrir registro relacionado de "Stock bajo"' }));

    expect(props.onOpenRelated).toHaveBeenCalledWith(notification);
  });

  it('shows an empty state when the user has no notifications', () => {
    renderPanel({ notifications: [], unreadCount: 0 });

    expect(screen.getByText('No existen notificaciones')).toBeInTheDocument();
    expect(screen.getByLabelText('0 notificaciones no leídas')).toHaveTextContent('0 sin leer');
  });

  it('keeps notifications and their read state after reopening the component', () => {
    const first = renderPanel({ notifications: [readNotification], unreadCount: 0 });
    expect(screen.getByText('Leída')).toBeInTheDocument();
    expect(screen.getByText('Stock bajo')).toBeInTheDocument();
    first.unmount();

    renderPanel({ notifications: [readNotification], unreadCount: 0 });

    expect(screen.getByText('Leída')).toBeInTheDocument();
    expect(screen.getByText('Stock bajo')).toBeInTheDocument();
    expect(screen.getByText('El producto está por debajo del mínimo')).toBeInTheDocument();
  });

  it('shows an insufficient permissions message and does not navigate', async () => {
    const onOpenRelated = vi.fn().mockRejectedValue(
      new Error('No tiene permisos suficientes para consultar el registro relacionado'),
    );
    renderPanel({ onOpenRelated });

    await userEvent.click(screen.getByRole('button', { name: 'Abrir registro relacionado de "Stock bajo"' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No tiene permisos suficientes para consultar el registro relacionado',
    );
  });

  it('announces loading and errors separately and allows retry', async () => {
    const { props, rerender } = renderPanel({ state: 'loading', notifications: [] });

    expect(screen.getByRole('status')).toHaveTextContent('Cargando notificaciones');

    rerender(<NotificationsPanel {...props} state="error" notifications={[]} />);

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron cargar las notificaciones');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(props.onRetry).toHaveBeenCalledOnce();
  });
});
