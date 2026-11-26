import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../../common/components/toast-context';
import { BatchEntryForm } from '../components/batch-entry-form';
import { inventoryApi } from '../services/inventory-api';
import type { BatchEntryDraft, BatchEntryResult, Product } from '../types';

// HU-02: el Bodeguero registra la entrada de un lote y ve las existencias actualizadas.
export function BatchEntryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastEntry, setLastEntry] = useState<BatchEntryResult | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    inventoryApi.listProducts('').then((loaded) => {
      if (!cancelled) setProducts(loaded);
    }).catch(() => {
      if (!cancelled) showToast('No se pudieron cargar los productos.', 'error');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [showToast]);

  async function register(draft: BatchEntryDraft) {
    try {
      const result = await inventoryApi.registerBatchEntry(draft);
      // Refleja el nuevo stock en el selector sin recargar la lista.
      setProducts((current) => current.map((product) => (
        product.id === result.product.id ? { ...product, stock: result.product.stock } : product
      )));
      setLastEntry(result);
      showToast('Entrada de lote registrada correctamente', 'success');
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'No se pudo registrar la entrada de lote.', 'error');
      throw cause;
    }
  }

  return (
    <section className="inventory-page inventory-form-page">
      <Link className="back-link" to="/inventory/products">← Volver a productos</Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Inventario · Entradas</span>
          <h2>Registrar entrada de lote</h2>
          <p>Indica el producto, el lote, su fecha de caducidad y la cantidad recibida.</p>
        </div>
      </div>

      {lastEntry && (
        <div className="catalog-card batch-entry-summary" role="status">
          <strong>Lote {lastEntry.batch.code} registrado</strong>
          <span>
            Se sumaron {lastEntry.batch.initialQuantity} unidades a {lastEntry.product.name}.
            Existencias disponibles: <b>{lastEntry.product.stock}</b>.
          </span>
        </div>
      )}

      <BatchEntryForm products={products} productsLoading={loading} onSubmit={register} />
    </section>
  );
}
