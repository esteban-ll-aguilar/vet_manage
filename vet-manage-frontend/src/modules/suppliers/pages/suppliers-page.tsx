import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { suppliersApi } from '../services/suppliers-api';
import type { SupplierListResponse, SupplierStatusFilter } from '../types';
import { supplierApiErrorMessage } from '../schemas/supplier';
import { useAuth } from '../../auth/auth-context';
import './suppliers-page.css';

const PAGE_SIZE = 10;

export function SuppliersPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('suppliers:create');
  const canUpdate = hasPermission('suppliers:update');
  const [suppliers, setSuppliers] = useState<SupplierListResponse | null>(null);
  const [searchDraft, setSearchDraft] = useState('');
  const [statusDraft, setStatusDraft] = useState<SupplierStatusFilter | ''>('');
  const [filters, setFilters] = useState<{ search: string; status: SupplierStatusFilter | '' }>({ search: '', status: '' });
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;

    suppliersApi.list({
      page,
      pageSize: PAGE_SIZE,
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    }).then((result) => {
      if (current) setSuppliers(result);
    }).catch((cause: unknown) => {
      if (current) setError(supplierApiErrorMessage(cause, 'No se pudo cargar el listado de proveedores.'));
    }).finally(() => {
      if (current) setLoading(false);
    });

    return () => { current = false; };
  }, [filters, page, reload]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setPage(1);
    setFilters({ search: searchDraft.trim(), status: statusDraft });
  }

  function clearFilters() {
    setLoading(true);
    setError(null);
    setSearchDraft('');
    setStatusDraft('');
    setPage(1);
    setFilters({ search: '', status: '' });
  }

  function changePage(nextPage: number) {
    setLoading(true);
    setError(null);
    setPage(nextPage);
  }

  function retryLoad() {
    setLoading(true);
    setError(null);
    setReload((value) => value + 1);
  }

  return (
    <section className="inventory-page suppliers-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Inventario · Tienda</span>
          <h2>Proveedores</h2>
          <p>Consulte y mantenga los datos de los proveedores registrados.</p>
        </div>
        {canCreate && <Link className="button button--primary" to="/inventory/suppliers/new">＋ Registrar proveedor</Link>}
      </div>

      <aside className="supplier-notice" aria-label="Disponibilidad de desactivación">
        <strong>Desactivación pendiente</strong>
        <span>Esta acción estará disponible cuando se integre la verificación de órdenes de compra pendientes.</span>
      </aside>

      <form className="supplier-toolbar" onSubmit={applyFilters}>
        <label className="field supplier-toolbar__search">
          <span>Buscar por razón social o RUC</span>
          <input
            type="search"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="field supplier-toolbar__status">
          <span>Estado</span>
          <select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value as SupplierStatusFilter | '')}>
            <option value="">Todos</option>
            <option value="ACTIVE">Activos</option>
            <option value="INACTIVE">Inactivos</option>
          </select>
        </label>
        <div className="supplier-toolbar__actions">
          <button className="button button--primary" type="submit">Buscar</button>
          <button className="button button--ghost" type="button" onClick={clearFilters}>Limpiar</button>
        </div>
      </form>

      <div className="catalog-card supplier-list-card" aria-busy={loading}>
        {loading ? (
          <div className="empty-state" role="status">Cargando proveedores…</div>
        ) : error ? (
          <div className="supplier-message supplier-message--error" role="alert">
            <p>{error}</p>
            <button className="button button--secondary" type="button" onClick={retryLoad}>
              Reintentar
            </button>
          </div>
        ) : !suppliers || suppliers.items.length === 0 ? (
          <div className="empty-state">
            <strong>{filters.search || filters.status ? 'No hay resultados para estos filtros' : 'Aún no hay proveedores registrados'}</strong>
            <span>{filters.search || filters.status ? 'Cambie los filtros e inténtelo nuevamente.' : 'Los proveedores aparecerán aquí cuando sean registrados.'}</span>
            {canCreate && !filters.search && !filters.status && (
              <Link className="button button--primary" to="/inventory/suppliers/new">Registrar proveedor</Link>
            )}
          </div>
        ) : (
          <>
            <div className="supplier-table-wrap">
              <table className="product-table supplier-table">
                <caption className="sr-only">Listado de proveedores</caption>
                <thead>
                  <tr>
                    <th scope="col">Razón social</th>
                    <th scope="col">RUC</th>
                    <th scope="col">Estado</th>
                    {canUpdate && <th scope="col">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {suppliers.items.map((supplier) => (
                    <tr key={supplier.id}>
                      <td><strong>{supplier.businessName}</strong></td>
                      <td><span className="supplier-ruc">{supplier.ruc}</span></td>
                      <td>
                        <span className={`status-badge ${supplier.isActive ? 'status-badge--active' : 'status-badge--inactive'}`}>
                          {supplier.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      {canUpdate && (
                        <td>
                          <Link
                            className="button button--ghost button--small"
                            to={`/inventory/suppliers/${encodeURIComponent(supplier.id)}/edit`}
                            aria-label={`Editar proveedor ${supplier.businessName}`}
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
            <div className="supplier-pagination" aria-label="Paginación de proveedores">
              <span>{suppliers.total} {suppliers.total === 1 ? 'proveedor' : 'proveedores'}</span>
              <div className="supplier-pagination__controls">
                <span aria-live="polite">
                  {suppliers.totalPages === 0 ? 'Sin páginas' : `Página ${suppliers.page} de ${suppliers.totalPages}`}
                </span>
                <button
                  className="button button--ghost button--small"
                  type="button"
                  onClick={() => changePage(suppliers.page - 1)}
                  disabled={loading || suppliers.page <= 1}
                >
                  Anterior
                </button>
                <button
                  className="button button--ghost button--small"
                  type="button"
                  onClick={() => changePage(suppliers.page + 1)}
                  disabled={loading || suppliers.page >= suppliers.totalPages}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
