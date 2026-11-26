import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ToastContext } from './toast-context';
import type { ToastType } from './toast-context';

type Toast = {
  id: number;
  message: string;
  type: ToastType;
};

type ConfirmData = {
  message: string;
  actionLabel: string;
  type: 'danger' | 'success';
  resolve: (accepted: boolean) => void;
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmData, setConfirmData] = useState<ConfirmData | null>(null);
  const nextId = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, message, type }].slice(-4));
  }, []);

  const confirm = useCallback((
    message: string,
    actionLabel = 'Aceptar',
    type: 'danger' | 'success' = 'danger'
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmData({
        message,
        actionLabel,
        type,
        resolve
      });
    });
  }, []);

  const handleConfirm = (accepted: boolean) => {
    confirmData?.resolve(accepted);
    setConfirmData(null);
  };

  return (
    <ToastContext.Provider value={{ showToast, dismissToast, confirm }}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />)}
      </div>
      {confirmData && (
        <div className="confirm-overlay">
          <div
            className={`confirm-modal confirm-modal--${confirmData.type}`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
          >
            <h3 id="confirm-title">
              {confirmData.type === 'danger'
                ? '¿Estás seguro?'
                : 'Confirmar activación'}
            </h3>

            <p>{confirmData.message}</p>

            <div className="confirm-actions">
              <button
                type="button"
                className="confirm-cancel"
                onClick={() => handleConfirm(false)}
              >
                No
              </button>

              <button
                type="button"
                className={`button button--${confirmData.type}-soft`}
                onClick={() => handleConfirm(true)}
              >
                {confirmData.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timeout = window.setTimeout(() => onDismiss(toast.id), 4500);
    return () => window.clearTimeout(timeout);
  }, [onDismiss, toast.id]);

  const label = { success: 'Listo', error: 'No se pudo completar', warning: 'Atención', info: 'Información' }[toast.type];
  const icon = { success: '✓', error: '!', warning: '!', info: 'i' }[toast.type];

  return (
    <div className={`toast toast--${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>
      <span className="toast__icon" aria-hidden="true">{icon}</span>
      <div className="toast__copy"><strong>{label}</strong><span>{toast.message}</span></div>
      <button className="toast__close" type="button" aria-label="Cerrar notificación" onClick={() => onDismiss(toast.id)}>×</button>
    </div>
  );
}
