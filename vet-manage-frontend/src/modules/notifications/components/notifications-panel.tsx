import { useEffect, useId, useRef, useState } from 'react';
import { ArrowRightIcon, CheckIcon, InfoIcon } from '../../../common/components/icons';
import type { Notification } from '../types';
import './notifications-panel.css';

type PanelState = 'loading' | 'error' | 'success';

type NotificationsPanelProps = {
  id?: string;
  state: PanelState;
  notifications: Notification[];
  unreadCount: number;
  onRetry: () => void;
  onClose: () => void;
  onMarkAsRead: (notification: Notification) => Promise<void>;
  onOpenRelated: (notification: Notification) => Promise<void>;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

export function NotificationsPanel({
  id,
  state,
  notifications,
  unreadCount,
  onRetry,
  onClose,
  onMarkAsRead,
  onOpenRelated,
}: NotificationsPanelProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  async function markAsRead(notification: Notification) {
    setBusyId(notification.id);
    setActionError(null);
    try {
      await onMarkAsRead(notification);
    } catch (cause) {
      setActionError(errorMessage(cause, 'No se pudo marcar la notificación como leída.'));
    } finally {
      setBusyId(null);
    }
  }

  async function openRelated(notification: Notification) {
    setBusyId(notification.id);
    setActionError(null);
    try {
      await onOpenRelated(notification);
    } catch (cause) {
      setActionError(errorMessage(cause, 'No se pudo abrir el registro relacionado.'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div
      className="notifications-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        id={id}
        className="notifications-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="notifications-header">
          <div>
            <span className="eyebrow">Tienda · Inventario</span>
            <h2 id={titleId}>Notificaciones</h2>
          </div>
          <div className="notifications-header__actions">
            <span className="notifications-count" aria-label={`${unreadCount} notificaciones no leídas`}>
              {unreadCount} sin leer
            </span>
            <button
              ref={closeRef}
              className="modal-card__close"
              type="button"
              aria-label="Cerrar notificaciones"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </header>

        {state === 'loading' && (
          <p className="notifications-state" role="status" aria-busy="true">
            Cargando notificaciones…
          </p>
        )}

        {state === 'error' && (
          <div className="notifications-state notifications-state--error" role="alert">
            <p>No se pudieron cargar las notificaciones.</p>
            <button className="button button--secondary button--small" type="button" onClick={onRetry}>
              Reintentar
            </button>
          </div>
        )}

        {state === 'success' && notifications.length === 0 && (
          <div className="notifications-empty" role="status">
            <span className="notifications-empty__icon" aria-hidden="true"><InfoIcon size={20} /></span>
            <strong>No existen notificaciones</strong>
            <p>Cuando el módulo genere alertas, aparecerán aquí.</p>
          </div>
        )}

        {state === 'success' && notifications.length > 0 && (
          <ul className="notifications-list" aria-label="Historial de notificaciones">
            {notifications.map((notification) => {
              const expanded = expandedId === notification.id;
              const busy = busyId === notification.id;
              return (
                <li
                  key={notification.id}
                  className={`notification-item${notification.leida ? '' : ' notification-item--unread'}`}
                >
                  <div className="notification-item__heading">
                    <strong>{notification.titulo}</strong>
                    <span className={`notification-item__badge notification-item__badge--${notification.leida ? 'read' : 'unread'}`}>
                      {notification.leida ? 'Leída' : 'No leída'}
                    </span>
                  </div>

                  <div className="notification-item__meta">
                    <time dateTime={notification.fechaEmitida}>{formatDate(notification.fechaEmitida)}</time>
                    <span>{notification.type.name}</span>
                    <span className={`notification-item__priority notification-item__priority--${notification.prioridad.toLowerCase()}`}>
                      {notification.prioridad}
                    </span>
                  </div>

                  <p className="notification-item__message">{notification.mensaje}</p>

                  {notification.detalle && (
                    <div className="notification-item__detail">
                      <button
                        className="text-button"
                        type="button"
                        aria-expanded={expanded}
                        aria-label={`${expanded ? 'Ocultar' : 'Ver'} detalle de "${notification.titulo}"`}
                        onClick={() => setExpandedId(expanded ? null : notification.id)}
                      >
                        {expanded ? 'Ocultar detalle' : 'Ver detalle'}
                      </button>
                      {expanded && <p>{notification.detalle}</p>}
                    </div>
                  )}

                  <div className="notification-item__actions">
                    {!notification.leida && (
                      <button
                        className="button button--secondary button--small"
                        type="button"
                        aria-label={`Marcar "${notification.titulo}" como leída`}
                        disabled={busy}
                        onClick={() => void markAsRead(notification)}
                      >
                        <CheckIcon size={14} />
                        {busy ? 'Marcando…' : 'Marcar como leída'}
                      </button>
                    )}
                    <button
                      className="button button--ghost button--small"
                      type="button"
                      aria-label={`Abrir registro relacionado de "${notification.titulo}"`}
                      disabled={busy}
                      onClick={() => void openRelated(notification)}
                    >
                      <ArrowRightIcon size={14} />
                      Ver registro relacionado
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {actionError && (
          <p className="notifications-action-error" role="alert">{actionError}</p>
        )}
      </section>
    </div>
  );
}
