import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { BellIcon } from '../../../common/components/icons';
import { useAuth } from '../../auth/auth-context';
import { notificationsApi } from '../services/notifications-api';
import type { Notification } from '../types';
import { NotificationsPanel } from './notifications-panel';

type PanelState = 'loading' | 'error' | 'success';

export function NotificationsBell() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<PanelState>('loading');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const fetchNotifications = useCallback(async () => {
    const [items, count] = await Promise.all([
      notificationsApi.list(),
      notificationsApi.unreadCount(),
    ]);
    return { items, count };
  }, []);

  const load = useCallback(async () => {
    try {
      const { items, count } = await fetchNotifications();
      setNotifications(items);
      setUnreadCount(count.unreadCount);
      setState('success');
    } catch {
      setState('error');
    }
  }, [fetchNotifications]);

  useEffect(() => {
    let cancelled = false;
    notificationsApi.unreadCount()
      .then((count) => {
        if (!cancelled) setUnreadCount(count.unreadCount);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    fetchNotifications()
      .then(({ items, count }) => {
        if (cancelled) return;
        setNotifications(items);
        setUnreadCount(count.unreadCount);
        setState('success');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });

    return () => { cancelled = true; };
  }, [open, fetchNotifications]);

  if (!hasPermission('inventory:read')) return null;

  function toggle() {
    if (!open) setState('loading');
    setOpen((value) => !value);
  }

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  async function markAsRead(notification: Notification) {
    const updated = await notificationsApi.markAsRead(notification.id);
    setNotifications((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    setUnreadCount((current) => Math.max(0, current - (notification.leida ? 0 : 1)));
  }

  async function openRelated(notification: Notification) {
    const record = await notificationsApi.relatedRecord(notification.id);
    setOpen(false);
    navigate(record.route);
  }

  return (
    <>
      <button
        ref={triggerRef}
        className={`sidebar-link notifications-trigger${open ? ' sidebar-link--active' : ''}`}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={toggle}
      >
        <BellIcon size={18} />
        <span>Notificaciones</span>
        {unreadCount > 0 && (
          <span className="notifications-badge" aria-label={`${unreadCount} notificaciones no leídas`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && createPortal(
        <NotificationsPanel
          id={panelId}
          state={state}
          notifications={notifications}
          unreadCount={unreadCount}
          onRetry={() => { setState('loading'); void load(); }}
          onClose={close}
          onMarkAsRead={markAsRead}
          onOpenRelated={openRelated}
        />,
        document.body,
      )}
    </>
  );
}
