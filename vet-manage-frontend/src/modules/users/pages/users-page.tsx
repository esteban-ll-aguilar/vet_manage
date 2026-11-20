import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/auth-context';
import { usersApi } from '../services/users-api';
import type { AssignableRole, UserPage, UserQuery, UserStatus } from '../types';
import './users-page.css';

const statusLabels: Record<UserStatus, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  DEACTIVATED: 'De baja',
};

const statusClasses: Record<UserStatus, string> = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DEACTIVATED: 'deactivated',
};

function emptyPage(page: number, pageSize: number): UserPage {
  return { items: [], total: 0, page, pageSize };
}

export function UsersPage() {
  const { hasPermission } = useAuth();
  const canAssignRoles = hasPermission('users:assign-roles');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState<UserQuery>({ page: 1, pageSize: 20 });
  const [result, setResult] = useState<UserPage>(emptyPage(1, 20));
  const [roles, setRoles] = useState<AssignableRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      usersApi.list(query),
      usersApi.assignableRoles().catch(() => [] as AssignableRole[]),
    ])
      .then(([page, availableRoles]) => {
        if (cancelled) return;
        setResult(page);
        setRoles(availableRoles);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setResult(emptyPage(query.page ?? 1, query.pageSize ?? 20));
        setError(cause instanceof Error ? cause.message : 'No se pudo cargar la lista de usuarios.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  function request(changes: Partial<UserQuery>, resetPage: boolean) {
    setLoading(true);
    setError(null);
    setQuery((current) => ({
      ...current,
      ...changes,
      ...(resetPage ? { page: 1 } : {}),
    }));
  }

  function applyFilters(changes: Partial<UserQuery>) {
    request(changes, true);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyFilters({ q: search.trim() || undefined });
  }

  function clearSearch() {
    setSearch('');
    setLoading(true);
    setError(null);
    setQuery({ page: 1, pageSize: 20 });
  }

  return (
    <section className="users-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Administración</span>
          <h2>Usuarios</h2>
          <p>Gestione las cuentas del personal de la clínica y sus roles.</p>
        </div>
        {hasPermission('users:create') && (
          <Link className="button button--primary" to="/users/new">Nuevo usuario</Link>
        )}
      </div>

      <form className="users-filters" onSubmit={submitSearch}>
        <label className="field users-filter users-filter--search">
          <span>Buscar</span>
          <input
            aria-label="Buscar usuarios"
            value={search}
            onChange={(event) => {
              const value = event.target.value;
              setSearch(value);
              if (value === '' && query.q) {
                applyFilters({ q: undefined });
              }
            }}
            placeholder="Cédula o nombre"
          />
        </label>
        <label className="field users-filter">
          <span>Rol</span>
          <select
            aria-label="Filtrar por rol"
            value={query.role ?? ''}
            onChange={(event) => applyFilters({ role: event.target.value || undefined })}
          >
            <option value="">Todos los roles</option>
            {roles.map((role) => (
              <option key={role.name} value={role.name}>{role.displayName}</option>
            ))}
          </select>
        </label>
        <label className="field users-filter">
          <span>Estado</span>
          <select
            aria-label="Filtrar por estado"
            value={query.status ?? ''}
            onChange={(event) => applyFilters({ status: (event.target.value || undefined) as UserStatus | undefined })}
          >
            <option value="">Todos los estados</option>
            <option value="ACTIVE">Activo</option>
            <option value="INACTIVE">Inactivo</option>
            <option value="DEACTIVATED">De baja</option>
          </select>
        </label>
        <div className="users-filter-actions">
          <button className="button button--secondary users-search-button" type="submit">Buscar</button>
          <button className="button button--ghost" type="button" onClick={clearSearch}>Limpiar búsqueda</button>
        </div>
      </form>

      <div className="catalog-card">
        {loading ? (
          <div className="empty-state">Cargando usuarios…</div>
        ) : error ? (
          <div className="inline-notice inline-notice--error" role="alert">{error}</div>
        ) : result.items.length === 0 ? (
          <div className="empty-state"><strong>No se encontraron usuarios</strong></div>
        ) : (
          <div className="product-table-wrap">
            <table className="product-table users-table" aria-label="Usuarios">
              <thead>
                <tr>
                  <th>Cédula</th>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Roles</th>
                  <th>Estado</th>
                  {canAssignRoles && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {result.items.map((user) => (
                  <tr key={user.id}>
                    <td><span className="code-pill">{user.identification}</span></td>
                    <td><strong>{user.firstName} {user.lastName}</strong></td>
                    <td>{user.email}</td>
                    <td>{user.roles.map((role) => role.displayName).join(', ') || '—'}</td>
                    <td>
                      <span className={`status-badge status-badge--${statusClasses[user.status]}`}>
                        {statusLabels[user.status]}
                      </span>
                    </td>
                    {canAssignRoles && (
                      <td className="users-actions-cell">
                        <Link className="button button--ghost button--small" to={`/users/${user.id}/roles`}>
                          Gestionar roles
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

      <div className="users-pagination">
        <span>{result.total} usuarios</span>
        <div className="users-pagination__controls">
          <button
            className="button button--ghost button--small"
            type="button"
            disabled={loading || result.page <= 1}
            onClick={() => request({ page: (query.page ?? 1) - 1 }, false)}
          >
            Anterior
          </button>
          <span>Página {result.page} de {totalPages}</span>
          <button
            className="button button--ghost button--small"
            type="button"
            disabled={loading || result.page >= totalPages}
            onClick={() => request({ page: (query.page ?? 1) + 1 }, false)}
          >
            Siguiente
          </button>
        </div>
      </div>
    </section>
  );
}
