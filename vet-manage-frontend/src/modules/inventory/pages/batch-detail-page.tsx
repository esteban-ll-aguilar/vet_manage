import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useToast } from '../../../common/components/toast-context';
import { inventoryApi } from '../services/inventory-api';
import type { BatchDetail } from '../types';

export function BatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    inventoryApi.getBatch(id).then((loaded) => {
      if (!cancelled) setBatch(loaded);
    }).catch(() => {
      if (!cancelled) {
        setError(true);
        showToast('No se pudo cargar el lote.', 'error');
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [id, showToast]);

  const isLoading = Boolean(id) && loading;
  const hasError = !id || error;

  return (
    <section className="inventory-page">
      <Link className="back-link" to="/inventory/products">← Volver a productos</Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Inventario · Lotes</span>
          <h2>Detalle del lote</h2>
          <p>Consulta el lote relacionado con la notificación.</p>
        </div>
      </div>

      {isLoading && <div className="empty-state" role="status">Cargando lote…</div>}

      {!isLoading && (hasError || !batch) && (
        <div className="empty-state" role="alert">
          <strong>No se pudo cargar el lote</strong>
          <span>Verifica que el registro siga disponible.</span>
        </div>
      )}

      {!isLoading && batch && (
        <div className="catalog-card">
          <div className="product-table-wrap">
            <table className="product-table detail-table" aria-label="Detalle del lote">
              <tbody>
                <tr><th scope="row">Código del lote</th><td><span className="code-pill">{batch.code}</span></td></tr>
                <tr><th scope="row">Producto</th><td>{batch.product.name} <small>({batch.product.code})</small></td></tr>
                <tr><th scope="row">Fecha de caducidad</th><td><time dateTime={batch.expirationDate}>{batch.expirationDate}</time></td></tr>
                <tr><th scope="row">Cantidad inicial</th><td>{batch.initialQuantity}</td></tr>
                <tr><th scope="row">Unidades disponibles</th><td className="price-cell">{batch.availableQuantity}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
