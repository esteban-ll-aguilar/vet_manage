import { useEffect, useId, useState } from 'react';
import type { ClientListItem, ClientStatus } from '../types';

export const DEACTIVATION_REASON_MAX = 500;
export const REASON_REQUIRED = 'Ingrese el motivo de la baja';

const statusLabels: Record<ClientStatus, string> = { ACTIVE: 'Activo', INACTIVE: 'Inactivo', DEACTIVATED: 'De baja' };
const statusClasses: Record<ClientStatus, string> = { ACTIVE: 'active', INACTIVE: 'inactive', DEACTIVATED: 'deactivated' };

function DeactivateClientIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

type Props = {
  client: ClientListItem;
  // Debe rechazar con un Error cuyo mensaje se muestra en el modal (por ejemplo, el de la API).
  onConfirm: (reason: string) => Promise<void>;
  onCancel: () => void;
};

// Confirmación de la baja definitiva de un cliente con motivo obligatorio (HU-03).
export function ClientDeactivateModal({ client, onConfirm, onCancel }: Props) {
  const reasonId = useId();
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, submitting]);

  async function confirm() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setReasonError(REASON_REQUIRED);
      return;
    }
    setSubmitting(true);
    setApiError(null);
    try {
      await onConfirm(trimmed);
    } catch (cause: unknown) {
      setApiError(cause instanceof Error ? cause.message : 'No se pudo dar de baja al cliente.');
      setSubmitting(false);
    }
  }

  return (
    <div
      className="clients-modal-backdrop"
      onClick={() => {
        if (!submitting) onCancel();
      }}
    >
      <div
        className="clients-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-deactivate-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="clients-modal__header">
          <div className="clients-modal__icon clients-modal__icon--deactivate">
            <DeactivateClientIcon />
          </div>
          <div className="clients-modal__title-wrap">
            <span className="clients-modal__eyebrow">Gestión de clientes</span>
            <h3 id="client-deactivate-dialog-title">Dar de baja cliente</h3>
          </div>
          <button className="clients-modal__close" type="button" aria-label="Cerrar" disabled={submitting} onClick={onCancel}>
            ×
          </button>
        </div>

        <div className="clients-modal__body">
          <div className="clients-modal__client-card">
            <div className="clients-modal__client-info">
              <strong>{client.firstName} {client.lastName}</strong>
              <span>{client.email}</span>
            </div>
            <div className="clients-modal__transition">
              <span className={`status-badge status-badge--${statusClasses[client.status]}`}>{statusLabels[client.status]}</span>
              <span className="clients-modal__arrow" aria-hidden="true">→</span>
              <span className="status-badge status-badge--deactivated">De baja</span>
            </div>
          </div>

          <p className="clients-modal__description">
            La baja es definitiva: el cliente no podrá usarse en nuevas transacciones. Su información, sus mascotas y su
            historial se conservan en modo de solo lectura.
          </p>

          <label className="field clients-deactivate-reason" htmlFor={reasonId}>
            <span>Motivo de la baja <b>*</b></span>
            <textarea
              id={reasonId}
              rows={3}
              maxLength={DEACTIVATION_REASON_MAX}
              value={reason}
              disabled={submitting}
              aria-invalid={Boolean(reasonError)}
              aria-describedby={`${reasonId}-help`}
              onChange={(event) => {
                setReason(event.target.value.slice(0, DEACTIVATION_REASON_MAX));
                setReasonError(null);
              }}
            />
            <small id={`${reasonId}-help`} className={reasonError ? 'field-error' : undefined}>
              {reasonError ?? `${reason.length}/${DEACTIVATION_REASON_MAX}`}
            </small>
          </label>

          {apiError && <div className="inline-notice inline-notice--error" role="alert">{apiError}</div>}
        </div>

        <div className="clients-modal__actions">
          <button className="button button--ghost" type="button" disabled={submitting} onClick={onCancel}>
            Cancelar
          </button>
          <button className="button clients-modal__confirm" type="button" disabled={submitting} onClick={() => void confirm()}>
            {submitting ? 'Guardando…' : 'Confirmar baja'}
          </button>
        </div>
      </div>
    </div>
  );
}
