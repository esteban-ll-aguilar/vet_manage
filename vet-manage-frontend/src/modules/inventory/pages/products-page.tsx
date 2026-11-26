import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { inventoryApi } from '../services/inventory-api';
import type { CatalogItem, Product } from '../types';
import { useToast } from '../../../common/components/toast-context';
import { useAuth } from '../../auth/auth-context';
import './products-page.css';

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [catalogs, setCatalogs] = useState<{ categories: CatalogItem[]; brands: CatalogItem[] }>({
    categories: [],
    brands: [],
  });
  const [query, setQuery] = useState({ search: '', categoryId: '', brandId: '', batchCode: '' });
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const { showToast } = useToast();
  const { hasPermission } = useAuth();
  const canManageProducts = hasPermission('inventory:manage-products');

  useEffect(() => {
    let cancelled = false;
    Promise.all([inventoryApi.listCategories(), inventoryApi.listBrands()])
      .then(([categories, brands]) => {
        if (!cancelled) setCatalogs({ categories, brands });
      })
      .catch(() => {
        if (!cancelled) showToast('No se pudieron cargar las categorías y marcas.', 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  useEffect(() => {
    let cancelled = false;
    inventoryApi.listProducts(query.search, {
      categoryId: query.categoryId,
      brandId: query.brandId,
      batchCode: query.batchCode,
    }).then((loadedProducts) => {
      if (!cancelled) {
        setProducts(loadedProducts);
        setStatus('ready');
      }
    }).catch((cause) => {
      if (!cancelled) {
        setStatus('error');
        showToast(cause instanceof Error ? cause.message : 'No se pudo cargar el catálogo.', 'error');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [query, showToast]);

  return (
    <section className="inventory-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Inventario</span>
          <h2>Productos</h2>
          <p>Administra el catálogo que utilizarás en tus entradas de inventario.</p>
        </div>
        {canManageProducts && (
          <Link className="button button--primary" to="/inventory/products/new">
            ＋ Nuevo producto
          </Link>
        )}
      </div>
      <form
        className="catalog-toolbar product-search-toolbar"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setStatus('loading');
          setQuery({ search: search.trim(), categoryId, brandId, batchCode: batchCode.trim() });
        }}
      >
        <label className="search-field">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="Buscar productos"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Código, nombre, categoría, marca o precio"
          />
        </label>
        <label className="field">
          <span>Categoría</span>
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">Todas las categorías</option>
            {catalogs.categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Marca</span>
          <select
            value={brandId}
            onChange={(event) => setBrandId(event.target.value)}
          >
            <option value="">Todas las marcas</option>
            {catalogs.brands.map((brand) => (
              <option key={brand.id} value={brand.id}>{brand.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Código de lote</span>
          <input
            value={batchCode}
            onChange={(event) => setBatchCode(event.target.value)}
            maxLength={50}
            placeholder="Ej. L-2026-001"
          />
        </label>
        <button className="button button--secondary" type="submit">Buscar</button>
        <button
          className="button button--ghost"
          type="button"
          onClick={() => {
            setSearch('');
            setCategoryId('');
            setBrandId('');
            setBatchCode('');
            setStatus('loading');
            setQuery({ search: '', categoryId: '', brandId: '', batchCode: '' });
          }}
        >
          Limpiar filtros
        </button>
      </form>
      <div className="catalog-card">
        {status === 'loading' && (
          <div className="empty-state" role="status">Cargando catálogo…</div>
        )}
        {status === 'error' && (
          <div className="empty-state" role="alert">No se pudo cargar el catálogo.</div>
        )}
        {status === 'ready' && products.length === 0 && (
          <div className="empty-state" role="status">
            {query.search || query.categoryId || query.brandId || query.batchCode ? (
              <>
                <strong>No se encontraron productos</strong>
                <span>Prueba con otro código, nombre, categoría, marca, lote o precio.</span>
              </>
            ) : (
              <>
                <strong>No hay productos todavía</strong>
                <span>{canManageProducts ? 'Registra el primero para comenzar tu catálogo.' : 'No hay productos disponibles para consultar.'}</span>
                {canManageProducts && (
                  <Link className="button button--primary" to="/inventory/products/new">
                    Registrar producto
                  </Link>
                )}
              </>
            )}
          </div>
        )}
        {status === 'ready' && products.length > 0 && (
          <div className="product-table-wrap">
            <table className="product-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Marca</th>
                  <th>Precio unitario</th>
                  <th>Existencias</th>
                  {canManageProducts && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td><span className="code-pill">{product.code}</span></td>
                    <td>
                      <strong>{product.name}</strong>
                      {product.description && <small>{product.description}</small>}
                    </td>
                    <td>{product.category.name}</td>
                    <td>{product.brand.name}</td>
                    <td className="price-cell">${Number(product.unitPrice).toFixed(2)}</td>
                    <td className="price-cell">{product.stock}</td>
                    {canManageProducts && (
                      <td>
                        <Link
                          className="button button--ghost button--small"
                          to={`/inventory/products/${product.id}/edit`}
                        >
                          Editar
                        </Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
