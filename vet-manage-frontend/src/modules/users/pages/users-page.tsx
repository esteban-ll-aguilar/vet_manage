import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../../common/components/toast-context';
import { useAuth } from '../../auth/auth-context';
import { UserEditModal } from '../components/user-edit-modal';
import { NOTICE_FAILED, UPDATED } from '../form-rules';
import { usersApi } from '../services/users-api';
import type {
  AssignableRole, ChangeableUserStatus, UpdateUserInput, UserDetail, UserListItem, UserPage, UserQuery, UserStatus,
} from '../types';
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

type PendingStatusChange = {
  user: UserListItem;
  targetStatus: ChangeableUserStatus;
};

function RolesIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l7 3v5c0 4.5-3 8.4-7 10-4-1.6-7-5.5-7-10V6l7-3z" />
      <path d="M9.5 12l1.8 1.8 3.7-3.8" />
    </svg>
  );
}

function InactivateUserIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="17" y1="8" x2="22" y2="13" />
      <line x1="22" y1="8" x2="17" y2="13" />
    </svg>
  );
}

function ActivateUserIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </svg>
  );
}

function EditUserIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function ViewUserIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function DeactivateUserIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function emptyPage(page: number, pageSize: number): UserPage {
  return { items: [], total: 0, page, pageSize };
}

export function UsersPage() {
  const { hasPermission } = useAuth();
  const canAssignRoles = hasPermission('users:assign-roles');
  const canChangeStatus = hasPermission('users:change-status');
  const canDeactivate = hasPermission('users:deactivate');
  const canUpdate = hasPermission('users:update');
  const canView = hasPermission('users:read');
  const showActions = canAssignRoles || canChangeStatus || canDeactivate || canUpdate || canView;
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState<UserQuery>({ page: 1, pageSize: 20 });
  const [result, setResult] = useState<UserPage>(emptyPage(1, 20));
  const [roles, setRoles] = useState<AssignableRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingStatusChange | null>(null);
  const [submittingStatus, setSubmittingStatus] = useState(false);
  const [pendingDeactivation, setPendingDeactivation] = useState<UserListItem | null>(null);
  const [deactivationReason, setDeactivationReason] = useState('');
  const [deactivationError, setDeactivationError] = useState<string | null>(null);
  const [submittingDeactivation, setSubmittingDeactivation] = useState(false);
  // Usuario abierto en el formulario de edición o en su ficha de solo lectura (HU-53).
  const [openedUser, setOpenedUser] = useState<{ user: UserDetail; readOnly: boolean } | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

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

  async function confirmStatusChange() {
    if (!pendingAction) return;
    const { user, targetStatus } = pendingAction;
    setSubmittingStatus(true);

    try {
      await usersApi.changeStatus(user.id, targetStatus);
      setResult((current) => ({
        ...current,
        items: current.items.map((item) => (item.id === user.id ? { ...item, status: targetStatus } : item)),
      }));
      showToast(targetStatus === 'INACTIVE' ? 'Cuenta inactivada correctamente' : 'Cuenta activada correctamente', 'success');
      setPendingAction(null);
    } catch (cause: unknown) {
      showToast(cause instanceof Error ? cause.message : 'No se pudo actualizar el estado de la cuenta.', 'error');
      setPendingAction(null);
    } finally {
      setSubmittingStatus(false);
    }
  }

  function openDeactivateModal(user: UserListItem) {
    setPendingDeactivation(user);
    setDeactivationReason('');
    setDeactivationError(null);
  }

  function closeDeactivateModal() {
    if (submittingDeactivation) return;
    setPendingDeactivation(null);
    setDeactivationReason('');
    setDeactivationError(null);
  }

  async function confirmDeactivation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingDeactivation || submittingDeactivation) return;
    const reason = deactivationReason.trim();
    if (!reason) {
      setDeactivationError('Ingrese el motivo de la baja');
      return;
    }

    const target = pendingDeactivation;
    setDeactivationError(null);
    setSubmittingDeactivation(true);
    try {
      const updated = await usersApi.deactivate(target.id, reason);
      setResult((current) => ({
        ...current,
        items: current.items.map((item) => (item.id === target.id
          ? { ...item, status: updated.status, roles: updated.roles }
          : item)),
      }));
      showToast('Usuario dado de baja correctamente', 'success');
      setPendingDeactivation(null);
      setDeactivationReason('');
    } catch (cause: unknown) {
      showToast(cause instanceof Error ? cause.message : 'No se pudo dar de baja al usuario.', 'error');
      setPendingDeactivation(null);
      setDeactivationReason('');
    } finally {
      setSubmittingDeactivation(false);
    }
  }

  // Consulta los datos actuales (incluido el teléfono, que no trae el listado) antes de abrir el formulario.
  async function openUser(user: UserListItem) {
    const readOnly = user.status === 'DEACTIVATED';
    setOpeningId(user.id);
    try {
      setOpenedUser({ user: await usersApi.get(user.id), readOnly });
    } catch (cause: unknown) {
      showToast(cause instanceof Error ? cause.message : 'No se pudieron consultar los datos del usuario.', 'error');
    } finally {
      setOpeningId(null);
    }
  }

  // Guarda la edición; si la API la rechaza, el error vuelve al formulario para resaltar los campos.
  async function saveUser(input: UpdateUserInput) {
    if (!openedUser) return;
    const updated = await usersApi.update(openedUser.user.id, input);
    setResult((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === updated.id
        ? { ...item, firstName: updated.firstName, lastName: updated.lastName, email: updated.email }
        : item)),
    }));
    setOpenedUser(null);
    showToast(UPDATED, 'success');
    if (updated.noticeSent === false) showToast(NOTICE_FAILED, 'warning');
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
                  {showActions && <th>Acciones</th>}
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
                    {showActions && (
                      <td className="users-actions-cell">
                        <div className="users-actions-group">
                          {canUpdate && user.status !== 'DEACTIVATED' && (
                            <button
                              className="users-icon-btn users-icon-btn--edit"
                              type="button"
                              aria-label={`Editar a ${user.firstName} ${user.lastName}`}
                              title="Editar"
                              data-tooltip="Editar"
                              disabled={openingId === user.id}
                              onClick={() => openUser(user)}
                            >
                              <EditUserIcon />
                            </button>
                          )}
                          {canView && user.status === 'DEACTIVATED' && (
                            <button
                              className="users-icon-btn users-icon-btn--view"
                              type="button"
                              aria-label={`Ver datos de ${user.firstName} ${user.lastName}`}
                              title="Ver datos"
                              data-tooltip="Ver datos"
                              disabled={openingId === user.id}
                              onClick={() => openUser(user)}
                            >
                              <ViewUserIcon />
                            </button>
                          )}
                          {canAssignRoles && user.status !== 'DEACTIVATED' && (
                            <Link
                              className="users-icon-btn users-icon-btn--roles"
                              to={`/users/${user.id}/roles`}
                              aria-label="Gestionar roles"
                              title="Gestionar roles"
                              data-tooltip="Gestionar roles"
                            >
                              <RolesIcon />
                            </Link>
                          )}
                          {canChangeStatus && user.status === 'ACTIVE' && (
                            <button
                              className="users-icon-btn users-icon-btn--inactivate"
                              type="button"
                              aria-label="Inactivar"
                              title="Inactivar"
                              data-tooltip="Inactivar"
                              onClick={() => setPendingAction({ user, targetStatus: 'INACTIVE' })}
                            >
                              <InactivateUserIcon />
                            </button>
                          )}
                          {canChangeStatus && user.status === 'INACTIVE' && (
                            <button
                              className="users-icon-btn users-icon-btn--activate"
                              type="button"
                              aria-label="Activar"
                              title="Activar"
                              data-tooltip="Activar"
                              onClick={() => setPendingAction({ user, targetStatus: 'ACTIVE' })}
                            >
                              <ActivateUserIcon />
                            </button>
                          )}
                          {canDeactivate && user.status !== 'DEACTIVATED' && (
                            <button
                              className="users-icon-btn users-icon-btn--deactivate"
                              type="button"
                              aria-label="Dar de baja"
                              title="Dar de baja"
                              data-tooltip="Dar de baja"
                              onClick={() => openDeactivateModal(user)}
                            >
                              <DeactivateUserIcon />
                            </button>
                          )}
                        </div>
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

      {openedUser && (
        <UserEditModal
          user={openedUser.user}
          readOnly={openedUser.readOnly}
          onSubmit={openedUser.readOnly ? undefined : saveUser}
          onClose={() => setOpenedUser(null)}
        />
      )}

      {pendingAction && (
        <div
          className="users-modal-backdrop"
          onClick={() => {
            if (!submittingStatus) setPendingAction(null);
          }}
        >
          <div
            className="users-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-status-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="users-modal__header">
              <div
                className={`users-modal__icon users-modal__icon--${
                  pendingAction.targetStatus === 'INACTIVE' ? 'inactivate' : 'activate'
                }`}
              >
                {pendingAction.targetStatus === 'INACTIVE' ? <InactivateUserIcon /> : <ActivateUserIcon />}
              </div>
              <div className="users-modal__title-wrap">
                <span className="users-modal__eyebrow">Gestión de cuenta</span>
                <h3 id="user-status-dialog-title">
                  {pendingAction.targetStatus === 'INACTIVE' ? 'Inactivar cuenta' : 'Activar cuenta'}
                </h3>
              </div>
              <button
                className="users-modal__close"
                type="button"
                aria-label="Cerrar"
                disabled={submittingStatus}
                onClick={() => setPendingAction(null)}
              >
                ×
              </button>
            </div>

            <div className="users-modal__body">
              <div className="users-modal__user-card">
                <div className="users-modal__user-info">
                  <strong>{pendingAction.user.firstName} {pendingAction.user.lastName}</strong>
                  <span>{pendingAction.user.email}</span>
                </div>
                <div className="users-modal__transition">
                  <span className={`status-badge status-badge--${statusClasses[pendingAction.user.status]}`}>
                    {statusLabels[pendingAction.user.status]}
                  </span>
                  <span className="users-modal__arrow" aria-hidden="true">→</span>
                  <span className={`status-badge status-badge--${statusClasses[pendingAction.targetStatus]}`}>
                    {statusLabels[pendingAction.targetStatus]}
                  </span>
                </div>
              </div>

              <p className="users-modal__description">
                {pendingAction.targetStatus === 'INACTIVE'
                  ? 'El usuario perderá el acceso de forma temporal y cualquier sesión abierta se cerrará en su siguiente acción. Sus registros históricos se conservarán intactos.'
                  : 'El usuario recuperará el acceso al sistema de inmediato con sus mismas credenciales y roles asignados.'}
              </p>
            </div>

            <div className="users-modal__actions">
              <button
                className="button button--ghost"
                type="button"
                disabled={submittingStatus}
                onClick={() => setPendingAction(null)}
              >
                Cancelar
              </button>
              <button
                className={`button users-modal__confirm users-modal__confirm--${
                  pendingAction.targetStatus === 'INACTIVE' ? 'inactivate' : 'activate'
                }`}
                type="button"
                disabled={submittingStatus}
                onClick={() => void confirmStatusChange()}
              >
                {submittingStatus ? 'Guardando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDeactivation && (
        <div
          className="users-modal-backdrop"
          onClick={closeDeactivateModal}
        >
          <div
            className="users-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-deactivate-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="users-modal__header">
              <div className="users-modal__icon users-modal__icon--deactivate">
                <DeactivateUserIcon />
              </div>
              <div className="users-modal__title-wrap">
                <span className="users-modal__eyebrow">Baja definitiva</span>
                <h3 id="user-deactivate-dialog-title">Dar de baja usuario</h3>
              </div>
              <button
                className="users-modal__close"
                type="button"
                aria-label="Cerrar"
                disabled={submittingDeactivation}
                onClick={closeDeactivateModal}
              >
                ×
              </button>
            </div>

            <form onSubmit={(event) => void confirmDeactivation(event)} noValidate>
              <div className="users-modal__body">
                <div className="users-modal__user-card">
                  <div className="users-modal__user-info">
                    <strong>{pendingDeactivation.firstName} {pendingDeactivation.lastName}</strong>
                    <span>{pendingDeactivation.email}</span>
                  </div>
                  <div className="users-modal__transition">
                    <span className={`status-badge status-badge--${statusClasses[pendingDeactivation.status]}`}>
                      {statusLabels[pendingDeactivation.status]}
                    </span>
                    <span className="users-modal__arrow" aria-hidden="true">→</span>
                    <span className="status-badge status-badge--deactivated">De baja</span>
                  </div>
                </div>

                <p className="users-modal__description">
                  Esta acción retira el acceso de personal de forma definitiva y cierra cualquier sesión abierta, conservando los registros históricos del usuario.
                </p>

                <label className="field users-modal__field">
                  <span>Motivo de la baja *</span>
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={deactivationReason}
                    disabled={submittingDeactivation}
                    placeholder="Ej. Renuncia, fin de contrato"
                    aria-invalid={Boolean(deactivationError)}
                    onChange={(event) => {
                      setDeactivationReason(event.target.value);
                      if (deactivationError) setDeactivationError(null);
                    }}
                  />
                  {deactivationError && (
                    <span className="users-modal__error" role="alert">{deactivationError}</span>
                  )}
                </label>
              </div>

              <div className="users-modal__actions">
                <button
                  className="button button--ghost"
                  type="button"
                  disabled={submittingDeactivation}
                  onClick={closeDeactivateModal}
                >
                  Cancelar
                </button>
                <button
                  className="button users-modal__confirm users-modal__confirm--deactivate"
                  type="submit"
                  disabled={submittingDeactivation}
                >
                  {submittingDeactivation ? 'Procesando…' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
