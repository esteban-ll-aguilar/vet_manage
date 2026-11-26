import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../../common/components/toast-context';
import { useAuth } from '../../auth/auth-context';
import { ClientDeactivateModal } from '../components/client-deactivate-modal';
import { ClientEditModal } from '../components/client-edit-modal';
import { UPDATED } from '../form-rules';
import { clientsApi } from '../services/clients-api';
import type { ClientListItem, ClientPage, ClientPet, ClientQuery, ClientStatus, UpdateClientInput } from '../types';
import './clients-page.css';

const SEARCH_VALIDATION_MESSAGE = 'Ingrese al menos 2 caracteres para buscar por nombre o los 10 dígitos de la cédula';

const statusLabels: Record<ClientStatus, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  DEACTIVATED: 'De baja',
};

const statusClasses: Record<ClientStatus, string> = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DEACTIVATED: 'deactivated',
};

function InactivateClientIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="17" y1="8" x2="22" y2="13" />
      <line x1="22" y1="8" x2="17" y2="13" />
    </svg>
  );
}

function ActivateClientIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </svg>
  );
}

type StatusTarget = 'ACTIVE' | 'INACTIVE';

// Textos del diálogo de confirmación según la acción: inactivar (HU-04) o activar (HU-05).
const STATUS_ACTIONS: Record<StatusTarget, {
  title: string;
  from: ClientStatus;
  description: string;
  success: string;
  failure: string;
}> = {
  INACTIVE: {
    title: 'Inactivar cliente',
    from: 'ACTIVE',
    description: 'El cliente no podrá ser seleccionado en nuevas transacciones mientras esté inactivo. Su información y los historiales clínicos de sus mascotas se conservarán intactos.',
    success: 'Cliente inactivado correctamente',
    failure: 'No se pudo inactivar al cliente.',
  },
  ACTIVE: {
    title: 'Activar cliente',
    from: 'INACTIVE',
    description: 'El cliente volverá a estar disponible para agendar citas y otras transacciones de la clínica. Su información y los historiales clínicos de sus mascotas se conservan sin cambios.',
    success: 'Cliente activado correctamente',
    failure: 'No se pudo activar al cliente.',
  },
};

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

const DEACTIVATED_OK = 'Cliente dado de baja correctamente';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

function EditClientIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function emptyPage(page: number, pageSize: number): ClientPage {
  return { items: [], total: 0, page, pageSize, totalPages: 0 };
}

export function ClientsPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('clients:create');
  const canInactivate = hasPermission('clients:inactivate');
  const canActivate = hasPermission('clients:activate');
  const canUpdate = hasPermission('clients:update');
  const canDeactivate = hasPermission('clients:deactivate');
  const { showToast } = useToast();
  const showActions = canInactivate || canActivate || canUpdate || canDeactivate;
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState<ClientQuery>({ page: 1, pageSize: 20 });
  const [result, setResult] = useState<ClientPage>(emptyPage(1, 20));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ client: ClientListItem; targetStatus: StatusTarget } | null>(null);
  const [editingClient, setEditingClient] = useState<ClientListItem | null>(null);
  const [deactivatingClient, setDeactivatingClient] = useState<ClientListItem | null>(null);
  const [submittingStatus, setSubmittingStatus] = useState(false);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [petsByClient, setPetsByClient] = useState<Record<string, ClientPet[]>>({});
  const [petsLoading, setPetsLoading] = useState(false);
  const [petsError, setPetsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    clientsApi.list(query)
      .then((page) => {
        if (cancelled) return;
        setResult(page);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setResult(emptyPage(query.page ?? 1, query.pageSize ?? 20));
        setError(cause instanceof Error ? cause.message : 'No se pudo cargar la lista de clientes.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  useEffect(() => {
    if (!expandedClient) return;
    let cancelled = false;

    clientsApi.pets(expandedClient)
      .then((pets) => {
        if (!cancelled) setPetsByClient((current) => ({ ...current, [expandedClient]: pets }));
      })
      .catch((cause: unknown) => {
        if (!cancelled) setPetsError(cause instanceof Error ? cause.message : 'No se pudieron cargar las mascotas.');
      })
      .finally(() => {
        if (!cancelled) setPetsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [expandedClient]);

  const totalPages = Math.max(1, result.totalPages || Math.ceil(result.total / result.pageSize));

  function request(changes: Partial<ClientQuery>, resetPage: boolean) {
    setLoading(true);
    setError(null);
    setQuery((current) => ({
      ...current,
      ...changes,
      ...(resetPage ? { page: 1 } : {}),
    }));
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = search.trim();
    if (term.length > 0 && term.length < 2) {
      setValidationError(SEARCH_VALIDATION_MESSAGE);
      return;
    }
    setValidationError(null);
    request({ search: term || undefined }, true);
  }

  function clearSearch() {
    setSearch('');
    setValidationError(null);
    request({ search: undefined, status: undefined }, true);
  }

  function togglePets(clientId: string) {
    setPetsError(null);
    if (expandedClient === clientId) {
      setExpandedClient(null);
      return;
    }
    setPetsLoading(true);
    setExpandedClient(clientId);
  }

  async function confirmStatusChange() {
    if (!pendingAction) return;
    const { client: target, targetStatus } = pendingAction;
    const texts = STATUS_ACTIONS[targetStatus];
    setSubmittingStatus(true);

    try {
      if (targetStatus === 'ACTIVE') await clientsApi.activate(target.id);
      else await clientsApi.inactivate(target.id);
      if (query.status) {
        const refreshed = await clientsApi.list(query);
        setResult(refreshed);
      } else {
        setResult((current) => ({
          ...current,
          items: current.items.map((item) => (item.id === target.id ? { ...item, status: targetStatus } : item)),
        }));
      }
      showToast(texts.success, 'success');
      setPendingAction(null);
    } catch (cause: unknown) {
      showToast(cause instanceof Error ? cause.message : texts.failure, 'error');
      setPendingAction(null);
    } finally {
      setSubmittingStatus(false);
    }
  }

  // Guarda la edición; si la API la rechaza, el error vuelve al formulario para resaltar los campos.
  async function saveClient(input: UpdateClientInput) {
    if (!editingClient) return;
    const updated = await clientsApi.update(editingClient.id, input);
    setResult((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === updated.id
        ? {
            ...item,
            firstName: updated.firstName,
            lastName: updated.lastName,
            email: updated.email,
            phone: updated.phone,
            address: updated.address,
          }
        : item)),
    }));
    setEditingClient(null);
    showToast(UPDATED, 'success');
  }

  // Baja definitiva (HU-03). Si la API la rechaza, el error se muestra en el modal, que sigue abierto.
  async function deactivateClient(reason: string) {
    if (!deactivatingClient) return;
    const target = deactivatingClient;
    const deactivated = await clientsApi.deactivate(target.id, reason);
    // Se recarga la página para traer el responsable de la baja; si falla, se actualiza la fila.
    try {
      setResult(await clientsApi.list(query));
    } catch {
      setResult((current) => ({
        ...current,
        items: current.items.map((item) => (item.id === target.id
          ? { ...item, status: 'DEACTIVATED', deactivatedAt: deactivated.deactivatedAt, deactivationReason: deactivated.deactivationReason }
          : item)),
      }));
    }
    setDeactivatingClient(null);
    showToast(DEACTIVATED_OK, 'success');
  }

  const activating = pendingAction?.targetStatus === 'ACTIVE';
  const pendingTexts = pendingAction ? STATUS_ACTIONS[pendingAction.targetStatus] : null;

  return (
    <section className="clients-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Administración</span>
          <h2>Clientes</h2>
          <p>Consulte los clientes registrados y sus mascotas vinculadas.</p>
        </div>
        {canCreate && (
          <Link className="button button--primary" to="/clients/new">Nuevo cliente</Link>
        )}
      </div>

      <form className="clients-filters" onSubmit={submitSearch}>
        <label className="field clients-filter clients-filter--search">
          <span>Buscar</span>
          <input
            aria-label="Buscar clientes"
            value={search}
            onChange={(event) => {
              const value = event.target.value;
              setSearch(value);
              setValidationError(null);
              if (value === '' && query.search) {
                request({ search: undefined }, true);
              }
            }}
            placeholder="Cédula, nombre o apellido"
          />
        </label>
        <label className="field clients-filter">
          <span>Estado</span>
          <select
            aria-label="Filtrar por estado"
            value={query.status ?? ''}
            onChange={(event) => request({ status: (event.target.value || undefined) as ClientStatus | undefined }, true)}
          >
            <option value="">Todos los estados</option>
            <option value="ACTIVE">Activo</option>
            <option value="INACTIVE">Inactivo</option>
            <option value="DEACTIVATED">De baja</option>
          </select>
        </label>
        <div className="clients-filter-actions">
          <button className="button button--secondary clients-search-button" type="submit">Buscar</button>
          <button className="button button--ghost" type="button" onClick={clearSearch}>Limpiar búsqueda</button>
        </div>
      </form>

      {validationError && <div className="inline-notice inline-notice--error" role="alert">{validationError}</div>}

      <div className="catalog-card">
        {loading ? (
          <div className="empty-state">Cargando clientes…</div>
        ) : error ? (
          <div className="inline-notice inline-notice--error" role="alert">{error}</div>
        ) : result.items.length === 0 ? (
          <div className="empty-state clients-empty-state">
            <strong>No se encontraron clientes registrados con el criterio ingresado</strong>
            {canCreate && (
              <Link className="button button--secondary" to="/clients/new">Registrar nuevo cliente</Link>
            )}
          </div>
        ) : (
          <div className="product-table-wrap">
            <table className="product-table clients-table" aria-label="Clientes">
              <thead>
                <tr>
                  <th>Cédula</th>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Estado</th>
                  <th>Mascotas</th>
                  {showActions && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {result.items.map((client) => (
                  <FragmentRow
                    key={client.id}
                    client={client}
                    canInactivate={canInactivate}
                    canActivate={canActivate}
                    canUpdate={canUpdate}
                    canDeactivate={canDeactivate}
                    expanded={expandedClient === client.id}
                    pets={petsByClient[client.id]}
                    petsLoading={petsLoading && expandedClient === client.id}
                    petsError={petsError && expandedClient === client.id ? petsError : null}
                    onToggle={() => togglePets(client.id)}
                    onInactivate={() => setPendingAction({ client, targetStatus: 'INACTIVE' })}
                    onActivate={() => setPendingAction({ client, targetStatus: 'ACTIVE' })}
                    onEdit={() => setEditingClient(client)}
                    onDeactivate={() => setDeactivatingClient(client)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="clients-pagination">
        <span>{result.total} clientes</span>
        <div className="clients-pagination__controls">
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

      {editingClient && (
        <ClientEditModal client={editingClient} onSubmit={saveClient} onCancel={() => setEditingClient(null)} />
      )}

      {deactivatingClient && (
        <ClientDeactivateModal
          client={deactivatingClient}
          onConfirm={deactivateClient}
          onCancel={() => setDeactivatingClient(null)}
        />
      )}

      {pendingAction && (
        <div
          className="clients-modal-backdrop"
          onClick={() => {
            if (!submittingStatus) setPendingAction(null);
          }}
        >
          <div
            className="clients-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="client-status-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="clients-modal__header">
              <div className={`clients-modal__icon${activating ? ' clients-modal__icon--activate' : ''}`}>
                {activating ? <ActivateClientIcon /> : <InactivateClientIcon />}
              </div>
              <div className="clients-modal__title-wrap">
                <span className="clients-modal__eyebrow">Gestión de clientes</span>
                <h3 id="client-status-dialog-title">{pendingTexts?.title}</h3>
              </div>
              <button
                className="clients-modal__close"
                type="button"
                aria-label="Cerrar"
                disabled={submittingStatus}
                onClick={() => setPendingAction(null)}
              >
                ×
              </button>
            </div>

            <div className="clients-modal__body">
              <div className="clients-modal__client-card">
                <div className="clients-modal__client-info">
                  <strong>{pendingAction.client.firstName} {pendingAction.client.lastName}</strong>
                  <span>{pendingAction.client.email}</span>
                </div>
                <div className="clients-modal__transition">
                  <StatusBadge status={STATUS_ACTIONS[pendingAction.targetStatus].from} />
                  <span className="clients-modal__arrow" aria-hidden="true">→</span>
                  <StatusBadge status={pendingAction.targetStatus} />
                </div>
              </div>

              <p className="clients-modal__description">{pendingTexts?.description}</p>
            </div>

            <div className="clients-modal__actions">
              <button
                className="button button--ghost"
                type="button"
                disabled={submittingStatus}
                onClick={() => setPendingAction(null)}
              >
                Cancelar
              </button>
              <button
                className={`button clients-modal__confirm${activating ? ' clients-modal__confirm--activate' : ''}`}
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
    </section>
  );
}

type FragmentRowProps = {
  client: ClientListItem;
  canInactivate: boolean;
  canActivate: boolean;
  canUpdate: boolean;
  canDeactivate: boolean;
  expanded: boolean;
  pets: ClientPet[] | undefined;
  petsLoading: boolean;
  petsError: string | null;
  onToggle: () => void;
  onInactivate: () => void;
  onActivate: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
};

function StatusBadge({ status }: { status: ClientStatus }) {
  return <span className={`status-badge status-badge--${statusClasses[status]}`}>{statusLabels[status]}</span>;
}

function FragmentRow({
  client,
  canInactivate,
  canActivate,
  canUpdate,
  canDeactivate,
  expanded,
  pets,
  petsLoading,
  petsError,
  onToggle,
  onInactivate,
  onActivate,
  onEdit,
  onDeactivate,
}: FragmentRowProps) {
  const showActions = canInactivate || canActivate || canUpdate || canDeactivate;
  return (
    <>
      <tr>
        <td><span className="code-pill">{client.identification}</span></td>
        <td><strong>{client.firstName} {client.lastName}</strong></td>
        <td>{client.email}</td>
        <td>
          <span className={`status-badge status-badge--${statusClasses[client.status]}`}>
            {statusLabels[client.status]}
          </span>
        </td>
        <td className="clients-pets-cell">
          <button
            className="button button--ghost button--small"
            type="button"
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Ocultar' : 'Ver'} mascotas de ${client.firstName} ${client.lastName}`}
            onClick={onToggle}
          >
            {expanded ? 'Ocultar mascotas' : 'Ver mascotas'}
          </button>
        </td>
        {showActions && (
          <td className="clients-actions-cell">
            {canUpdate && client.status !== 'DEACTIVATED' && (
              <button
                className="clients-icon-btn clients-icon-btn--edit"
                type="button"
                aria-label={`Editar a ${client.firstName} ${client.lastName}`}
                title="Editar"
                data-tooltip="Editar"
                onClick={onEdit}
              >
                <EditClientIcon />
              </button>
            )}
            {canInactivate && client.status === 'ACTIVE' && (
              <button
                className="clients-icon-btn clients-icon-btn--inactivate"
                type="button"
                aria-label="Inactivar"
                title="Inactivar"
                data-tooltip="Inactivar"
                onClick={onInactivate}
              >
                <InactivateClientIcon />
              </button>
            )}
            {canActivate && client.status === 'INACTIVE' && (
              <button
                className="clients-icon-btn clients-icon-btn--activate"
                type="button"
                aria-label="Activar"
                title="Activar"
                data-tooltip="Activar"
                onClick={onActivate}
              >
                <ActivateClientIcon />
              </button>
            )}
            {canDeactivate && client.status !== 'DEACTIVATED' && (
              <button
                className="clients-icon-btn clients-icon-btn--deactivate"
                type="button"
                aria-label={`Dar de baja a ${client.firstName} ${client.lastName}`}
                title="Dar de baja"
                data-tooltip="Dar de baja"
                onClick={onDeactivate}
              >
                <DeactivateClientIcon />
              </button>
            )}
          </td>
        )}
      </tr>
      {expanded && (
        <tr className="clients-pets-row">
          <td colSpan={showActions ? 6 : 5}>
            {client.status === 'DEACTIVATED' && (
              <dl className="clients-deactivation" aria-label="Datos de la baja">
                <div><dt>Dado de baja</dt><dd>{formatDate(client.deactivatedAt)}</dd></div>
                <div><dt>Responsable</dt><dd>{client.deactivatedBy ?? '—'}</dd></div>
                <div><dt>Motivo</dt><dd>{client.deactivationReason ?? '—'}</dd></div>
              </dl>
            )}
            {petsLoading ? (
              <span>Cargando mascotas…</span>
            ) : petsError ? (
              <span className="inline-notice inline-notice--error" role="alert">{petsError}</span>
            ) : pets && pets.length > 0 ? (
              <ul className="clients-pets-list">
                {pets.map((pet) => (
                  <li key={pet.id}>
                    <strong>{pet.name}</strong>
                    <span>{pet.code}</span>
                    <span>{pet.species} · {pet.breed}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <span>Sin mascotas vinculadas</span>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
