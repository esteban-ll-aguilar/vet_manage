import { useState } from 'react';
import type { ExpirationAlert } from '../types';

type ExpirationAlertsPanelProps = {
  alerts: ExpirationAlert[];
  state: 'loading' | 'error' | 'success';
  onRefresh?: () => void;
  canEdit?: boolean;
  onSaveExpiration?: (lotId: string, expirationDate: string) => Promise<void>;
};

export function ExpirationAlertsPanel({
  alerts,
  state,
  onRefresh,
  canEdit = false,
  onSaveExpiration,
}: ExpirationAlertsPanelProps) {
  const [editingLotId, setEditingLotId] = useState<string | null>(null);
  const [expirationDraft, setExpirationDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  function beginEditing(alert: ExpirationAlert) {
    setEditingLotId(alert.lotId);
    setExpirationDraft(alert.expirationDate);
    setSaveError(false);
  }

  async function saveExpiration() {
    if (!editingLotId || !onSaveExpiration || !expirationDraft) return;
    setSaving(true);
    setSaveError(false);
    try {
      await onSaveExpiration(editingLotId, expirationDraft);
      setEditingLotId(null);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel expiration-alerts" aria-labelledby="expiration-alerts-title">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Inventario</span>
          <h3 id="expiration-alerts-title">Alertas de caducidad</h3>
        </div>
        {state === 'success' && alerts.length > 0 && (
          <span className="count-pill" aria-label={`${alerts.length} alertas`}>{alerts.length}</span>
        )}
        {onRefresh && (
          <button className="text-button" type="button" onClick={onRefresh} disabled={state === 'loading'}>
            Actualizar
          </button>
        )}
      </div>

      {state === 'loading' && <p className="expiration-alerts__message" role="status">Cargando alertas de caducidad…</p>}

      {state === 'error' && (
        <p className="expiration-alerts__message expiration-alerts__message--error" role="alert">
          No se pudieron cargar las alertas de caducidad.
        </p>
      )}

      {state === 'success' && alerts.length === 0 && (
        <p className="expiration-alerts__message">No hay lotes próximos a caducar ni caducados</p>
      )}

      {state === 'success' && alerts.length > 0 && (
        <div className="expiration-alerts__table-wrap">
          <table className="product-table expiration-alerts__table" aria-label="Alertas de caducidad">
            <thead>
              <tr>
                <th scope="col">Producto</th>
                <th scope="col">Código del lote</th>
                <th scope="col">Fecha de caducidad</th>
                <th scope="col">Unidades disponibles</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr key={alert.lotId}>
                  <td>{alert.productName}</td>
                  <td><span className="code-pill">{alert.lotCode}</span></td>
                  <td>
                    {editingLotId === alert.lotId ? (
                      <div className="expiration-alerts__editor">
                        <input
                          type="date"
                          value={expirationDraft}
                          aria-label={`Nueva fecha de caducidad para ${alert.lotCode}`}
                          onChange={(event) => setExpirationDraft(event.target.value)}
                        />
                        <button className="button button--primary button--small" type="button" onClick={() => void saveExpiration()} disabled={!expirationDraft || saving}>
                          {saving ? 'Guardando…' : 'Guardar'}
                        </button>
                        <button className="button button--ghost button--small" type="button" onClick={() => setEditingLotId(null)} disabled={saving}>
                          Cancelar
                        </button>
                        {saveError && <small className="expiration-alerts__save-error" role="alert">No se pudo actualizar la fecha.</small>}
                      </div>
                    ) : (
                      <div className="expiration-alerts__date">
                        <time dateTime={alert.expirationDate}>{alert.expirationDate}</time>
                        {canEdit && onSaveExpiration && (
                          <button className="text-button" type="button" onClick={() => beginEditing(alert)} aria-label={`Editar caducidad de ${alert.lotCode}`}>
                            Editar
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td>{alert.availableQuantity}</td>
                  <td>
                    <span className={`tag ${alert.status === 'EXPIRED' ? 'tag-red' : 'tag-orange'}`}>
                      {alert.label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
