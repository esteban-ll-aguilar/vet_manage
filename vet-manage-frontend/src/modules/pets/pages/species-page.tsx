import { useEffect, useState } from 'react';
import { PawIcon, PlusIcon, SearchIcon } from '../../../common/components/icons';
import { useToast } from '../../../common/components/toast-context';
import { useAuth } from '../../auth/auth-context';
import { SpeciesForm } from '../components/species-form';
import { speciesApi } from '../services/species.service';
import type { RegisterSpeciesDraft, Species } from '../types';
import './species-page.css';

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function InactivateIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
    </svg>
  );
}

function ActivateIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <polyline points="8 12.5 11 15.5 16 9.5" />
    </svg>
  );
}

const statusLabel = (isActive: boolean) => (isActive ? 'Activa' : 'Inactiva');

function StatusBadge({ isActive }: { isActive: boolean }) {
  return <span className={`status-badge status-badge--${isActive ? 'active' : 'inactive'}`}>{statusLabel(isActive)}</span>;
}

// Textos del diálogo de confirmación según la acción (HU-15).
const STATUS_TEXTS = {
  inactivate: {
    title: 'Inactivar especie',
    description: 'La especie no se podrá elegir al registrar razas ni pacientes mientras esté inactiva. Sus razas y pacientes registrados se conservan.',
    success: 'Especie inactivada correctamente',
    failure: 'No se pudo inactivar la especie',
  },
  activate: {
    title: 'Activar especie',
    description: 'La especie volverá a estar disponible para registrar razas y pacientes.',
    success: 'Especie activada correctamente',
    failure: 'No se pudo activar la especie',
  },
} as const;

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

export function SpeciesPage() {
  const [species, setSpecies] = useState<Species[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editingSpecies, setEditingSpecies] = useState<Species | null>(null);
  const [viewingSpecies, setViewingSpecies] = useState<Species | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<{ species: Species; isActive: boolean } | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);
  const { showToast } = useToast();
  const { hasPermission } = useAuth();

  const canCreate = hasPermission('species:create');
  const canUpdate = hasPermission('species:update');
  const canChangeStatus = hasPermission('species:change-status');
  const showActions = canUpdate || canChangeStatus;
  const modalOpen = isCreateOpen || editingSpecies !== null || viewingSpecies !== null;
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase('es');
  const filteredSpecies = species.filter((item) =>
    item.name.toLocaleLowerCase('es').includes(normalizedSearch),
  );
  const statusTexts = pendingStatus ? STATUS_TEXTS[pendingStatus.isActive ? 'activate' : 'inactivate'] : null;

  useEffect(() => {
    let cancelled = false;
    speciesApi.listSpecies()
      .then((items) => {
        if (!cancelled) {
          setSpecies(items);
          setListError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setListError(cause instanceof Error ? cause.message : 'No se pudo cargar el catálogo de especies.');
        }
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!modalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) {
        setCreateOpen(false);
        setEditingSpecies(null);
        setViewingSpecies(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen, submitting]);

  useEffect(() => {
    if (!pendingStatus) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !changingStatus) setPendingStatus(null);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [pendingStatus, changingStatus]);

  const closeStatusDialog = () => {
    if (!changingStatus) setPendingStatus(null);
  };

  // Confirma el cambio de estado (HU-15); la fila se reemplaza con la especie que devuelve la API.
  const confirmStatusChange = async () => {
    if (!pendingStatus) return;
    const { species: target, isActive } = pendingStatus;
    const texts = STATUS_TEXTS[isActive ? 'activate' : 'inactivate'];
    setChangingStatus(true);
    try {
      const updated = await speciesApi.changeStatus(target.id, isActive);
      setSpecies((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      showToast(texts.success, 'success');
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : texts.failure, 'error');
    } finally {
      setChangingStatus(false);
      setPendingStatus(null);
    }
  };

  const closeModal = () => {
    if (submitting) return;
    setCreateOpen(false);
    setEditingSpecies(null);
    setViewingSpecies(null);
  };

  const handleRegister = async (draft: RegisterSpeciesDraft) => {
    setSubmitting(true);
    try {
      const created = await speciesApi.registerSpecies(draft);
      setSpecies((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name, 'es')));
      showToast('Especie registrada exitosamente', 'success');
      setCreateOpen(false);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'Error al registrar especie', 'error');
      throw cause;
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (draft: RegisterSpeciesDraft) => {
    if (!editingSpecies) return;
    setSubmitting(true);
    try {
      const updated = await speciesApi.updateSpecies(editingSpecies.id, draft);
      setSpecies((current) =>
        current
          .map((item) => (item.id === updated.id ? updated : item))
          .sort((a, b) => a.name.localeCompare(b.name, 'es')),
      );
      showToast('Especie actualizada exitosamente', 'success');
      setEditingSpecies(null);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'Error al actualizar especie', 'error');
      throw cause;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <form className="species-toolbar" role="search" onSubmit={(event) => event.preventDefault()}>
        <label className="search-field">
          <SearchIcon size={16} />
          <input
            type="search"
            aria-label="Buscar especies por nombre"
            placeholder="Buscar especie por nombre"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>
        {canCreate && (
          <button type="button" className="button button--primary" onClick={() => setCreateOpen(true)}>
            <PlusIcon size={16} />
            Nueva especie
          </button>
        )}
      </form>

      {listLoading ? (
        <div className="empty-state">Cargando especies…</div>
      ) : listError ? (
        <div className="inline-notice inline-notice--error" role="alert">{listError}</div>
      ) : species.length === 0 ? (
        <div className="catalog-empty" role="status">
          <span className="catalog-empty__icon">
            <PawIcon size={22} />
          </span>
          <strong>No hay especies registradas</strong>
          <p>Registra una nueva especie para comenzar a clasificar a los pacientes.</p>
        </div>
      ) : filteredSpecies.length === 0 ? (
        <div className="catalog-empty" role="status">
          <span className="catalog-empty__icon">
            <PawIcon size={22} />
          </span>
          <strong>No se encontraron especies</strong>
          <p>Prueba con otro nombre para encontrar una especie registrada.</p>
        </div>
      ) : (
        <div className="catalog-card">
          <div className="catalog-card__heading">
            <div className="species-card__title">
              <span className="species-card__icon" aria-hidden="true">
                <PawIcon size={18} />
              </span>
              <div>
                <h3>Especies registradas</h3>
                <p>Especies habilitadas para el registro de pacientes y razas.</p>
              </div>
            </div>
            <span className="species-count-badge">
              {filteredSpecies.length} {filteredSpecies.length === 1 ? 'especie' : 'especies'}
            </span>
          </div>
          <div className="product-table-wrap">
            <table className="product-table species-table" aria-label="Especies">
              <thead>
                <tr>
                  <th className="species-table__name">Nombre</th>
                  <th className="species-table__description">Descripción</th>
                  <th className="species-table__date">Actualizada</th>
                  <th className="species-table__status">Estado</th>
                  {showActions && <th className="species-table__actions">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {filteredSpecies.map((item) => (
                  <tr key={item.id}>
                    <td className="species-table__name">
                      <div className="species-name-cell">
                        <span className="species-row-icon" aria-hidden="true">
                          <PawIcon size={15} />
                        </span>
                        <button
                          type="button"
                          className="species-detail-trigger"
                          aria-label={`Ver información de ${item.name}`}
                          onClick={() => setViewingSpecies(item)}
                        >
                          {item.name}
                        </button>
                      </div>
                    </td>
                    <td className="species-table__description">
                      {item.description ? (
                        <span className="species-desc-cell">
                          <NoteIcon />
                          <span>{item.description}</span>
                        </span>
                      ) : (
                        <span className="species-desc-empty">Sin descripción</span>
                      )}
                    </td>
                    <td className="species-table__date">
                      <span className="species-date-cell">
                        <CalendarIcon />
                        <span>{formatShortDate(item.updatedAt)}</span>
                      </span>
                    </td>
                    <td className="species-table__status">
                      <StatusBadge isActive={item.isActive} />
                    </td>
                    {showActions && (
                      <td className="species-table__actions">
                        {canUpdate && (
                          <button
                            type="button"
                            className="species-icon-btn"
                            aria-label={`Editar ${item.name}`}
                            title="Editar especie"
                            data-tooltip="Editar especie"
                            onClick={() => setEditingSpecies(item)}
                          >
                            <EditIcon />
                          </button>
                        )}
                        {canChangeStatus && (item.isActive ? (
                          <button
                            type="button"
                            className="species-icon-btn species-icon-btn--inactivate"
                            aria-label={`Inactivar ${item.name}`}
                            title="Inactivar especie"
                            data-tooltip="Inactivar especie"
                            onClick={() => setPendingStatus({ species: item, isActive: false })}
                          >
                            <InactivateIcon />
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="species-icon-btn species-icon-btn--activate"
                            aria-label={`Activar ${item.name}`}
                            title="Activar especie"
                            data-tooltip="Activar especie"
                            onClick={() => setPendingStatus({ species: item, isActive: true })}
                          >
                            <ActivateIcon />
                          </button>
                        ))}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewingSpecies && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setViewingSpecies(null);
          }}
        >
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="species-detail-title">
            <div className="modal-card__heading">
              <div>
                <span className="eyebrow">Catálogo</span>
                <h3 id="species-detail-title">Información de la especie</h3>
                <p>Consulta los datos registrados de esta especie.</p>
              </div>
              <button
                type="button"
                className="modal-card__close"
                aria-label="Cerrar información"
                onClick={() => setViewingSpecies(null)}
              >
                ×
              </button>
            </div>
            <div className="modal-card__body">
              <dl className="species-detail__grid">
                <div>
                  <dt>Nombre</dt>
                  <dd>{viewingSpecies.name}</dd>
                </div>
                <div>
                  <dt>Descripción</dt>
                  <dd>{viewingSpecies.description || 'Sin descripción'}</dd>
                </div>
                <div>
                  <dt>Estado</dt>
                  <dd>
                    <span className={`status-badge status-badge--${viewingSpecies.isActive ? 'active' : 'inactive'}`}>
                      {viewingSpecies.isActive ? 'Activa' : 'Inactiva'}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      )}

      {pendingStatus && statusTexts && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeStatusDialog();
          }}
        >
          <div
            className="modal-card species-status-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="species-status-title"
          >
            <div className="modal-card__heading">
              <div>
                <span className="eyebrow">Catálogo</span>
                <h3 id="species-status-title">{statusTexts.title}</h3>
              </div>
              <button
                type="button"
                className="modal-card__close"
                aria-label="Cerrar"
                onClick={closeStatusDialog}
                disabled={changingStatus}
              >
                ×
              </button>
            </div>
            <div className="modal-card__body">
              <div className="species-status-dialog__species">
                <strong>{pendingStatus.species.name}</strong>
                <span className="species-status-dialog__transition">
                  <StatusBadge isActive={pendingStatus.species.isActive} />
                  <span aria-hidden="true">→</span>
                  <StatusBadge isActive={pendingStatus.isActive} />
                </span>
              </div>
              <p className="species-status-dialog__description">{statusTexts.description}</p>
              <div className="species-status-dialog__actions">
                <button type="button" className="button button--ghost" onClick={closeStatusDialog} disabled={changingStatus}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className={`button species-status-dialog__confirm${pendingStatus.isActive ? ' species-status-dialog__confirm--activate' : ''}`}
                  onClick={() => void confirmStatusChange()}
                  disabled={changingStatus}
                >
                  {changingStatus ? 'Guardando…' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="species-modal-title">
            <div className="modal-card__heading">
              <div>
                <span className="eyebrow">Catálogo</span>
                <h3 id="species-modal-title">{editingSpecies ? 'Editar especie' : 'Nueva especie'}</h3>
                <p>
                  {editingSpecies
                    ? 'Actualiza el nombre o la descripción de la especie seleccionada.'
                    : 'Completa los datos para agregarla al catálogo.'}
                </p>
              </div>
              <button
                type="button"
                className="modal-card__close"
                aria-label="Cerrar"
                onClick={closeModal}
                disabled={submitting}
              >
                ×
              </button>
            </div>
            <div className="modal-card__body">
              {editingSpecies ? (
                <SpeciesForm
                  key={editingSpecies.id}
                  initialValue={{ name: editingSpecies.name, description: editingSpecies.description }}
                  submitLabel="Guardar cambios"
                  onSubmit={handleUpdate}
                  onCancel={closeModal}
                  isLoading={submitting}
                />
              ) : (
                <SpeciesForm onSubmit={handleRegister} onCancel={closeModal} isLoading={submitting} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
