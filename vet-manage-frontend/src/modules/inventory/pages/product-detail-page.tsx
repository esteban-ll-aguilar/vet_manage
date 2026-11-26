import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useToast } from '../../../common/components/toast-context';
import { inventoryApi } from '../services/inventory-api';
import type { Product } from '../types';

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    inventoryApi.getProduct(id).then((loaded) => {
      if (!cancelled) setProduct(loaded);
    }).catch(() => {
      if (!cancelled) {
        setError(true);
        showToast('No se pudo cargar el producto.', 'error');
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
          <span className="eyebrow">Inventario · Productos</span>
          <h2>Detalle del producto</h2>
          <p>Consulta la información del producto relacionado con la notificación.</p>
        </div>
      </div>

      {isLoading && <div className="empty-state" role="status">Cargando producto…</div>}

      {!isLoading && (hasError || !product) && (
        <div className="empty-state" role="alert">
          <strong>No se pudo cargar el producto</strong>
          <span>Verifica que el registro siga disponible.</span>
        </div>
      )}

      {!isLoading && product && (
        <div className="catalog-card">
          <div className="product-table-wrap">
            <table className="product-table detail-table" aria-label="Detalle del producto">
              <tbody>
                <tr><th scope="row">Código</th><td><span className="code-pill">{product.code}</span></td></tr>
                <tr><th scope="row">Nombre</th><td>{product.name}</td></tr>
                <tr><th scope="row">Descripción</th><td>{product.description || 'Sin descripción'}</td></tr>
                <tr><th scope="row">Precio unitario</th><td className="price-cell">${Number(product.unitPrice).toFixed(2)}</td></tr>
                <tr><th scope="row">Existencias</th><td>{product.stock}</td></tr>
                <tr><th scope="row">Categoría</th><td>{product.category.name}</td></tr>
                <tr><th scope="row">Marca</th><td>{product.brand.name}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
