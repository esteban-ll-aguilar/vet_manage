import { useCallback, useEffect, useMemo, useState } from 'react';
import { PawIcon, PlusIcon } from '../../../common/components/icons';
import { useToast } from '../../../common/components/toast-context';
import { useAuth } from '../../auth/auth-context';
import { BreedForm } from '../components/breed-form';
import { breedApi } from '../services/breed.service';
import { speciesApi } from '../services/species.service';
import type { Breed, RegisterBreedDraft, Species, SpeciesOption } from '../types';

const SEARCH_DELAY_MS = 300;
const SEARCH_MAX = 100;
export const NO_BREEDS_FOUND = 'No se encontraron razas con el criterio ingresado';

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function StatusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2v10" />
      <path d="M18.4 6.6a8 8 0 1 1-12.8 0" />
    </svg>
  );
}

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

export function BreedsPage() {
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editingBreed, setEditingBreed] = useState<Breed | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [changingBreedId, setChangingBreedId] = useState<string | null>(null);
  const [species, setSpecies] = useState<SpeciesOption[]>([]);
  const [speciesLoading, setSpeciesLoading] = useState(false);
  const { showToast, confirm } = useToast();
  const { hasPermission } = useAuth();

  // HU-20: búsqueda por nombre, filtro por especie y detalle en solo lectura.
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState('');
  const [filterSpecies, setFilterSpecies] = useState<Species[]>([]);
  const [selectedBreed, setSelectedBreed] = useState<Breed | null>(null);

  const canCreate = hasPermission('breeds:create');
  const canUpdate = hasPermission('breeds:update');
  const canChangeStatus = hasPermission('breeds:change-status');
  const showActions = canUpdate || canChangeStatus;
  const modalOpen = isCreateOpen || editingBreed !== null;
  const hasFilters = debouncedSearch.trim() !== '' || speciesFilter !== '';

  // Espera 300 ms sin escribir antes de consultar.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  // Todas las especies (también inactivas) para poder consultar sus razas.
  useEffect(() => {
    let cancelled = false;
    speciesApi.listSpecies()
      .then((items) => {
        if (!cancelled) setFilterSpecies([...items].sort((a, b) => a.name.localeCompare(b.name, 'es')));
      })
      .catch(() => {
        if (!cancelled) setFilterSpecies([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    breedApi.listBreeds({ search: debouncedSearch, speciesId: speciesFilter || undefined })
      .then((items) => {
        if (!cancelled) {
          setBreeds(items);
          setListError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setListError(cause instanceof Error ? cause.message : 'No se pudo cargar el catálogo de razas.');
        }
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, speciesFilter]);

  const loadSpecies = useCallback(async () => {
    setSpeciesLoading(true);
    try {
      setSpecies(await speciesApi.listActiveSpecies());
    } catch (cause) {
      setSpecies([]);
      showToast(cause instanceof Error ? cause.message : 'No se pudieron cargar las especies', 'error');
    } finally {
      setSpeciesLoading(false);
    }
  }, [showToast]);

  const openCreateModal = () => {
    setEditingBreed(null);
    setCreateOpen(true);
    void loadSpecies();
  };

  const openEditModal = (breed: Breed) => {
    setCreateOpen(false);
    setEditingBreed(breed);
    void loadSpecies();
  };

  const closeModal = () => {
    if (submitting) return;
    setCreateOpen(false);
    setEditingBreed(null);
  };

  useEffect(() => {
    if (!modalOpen && !selectedBreed) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) {
        setCreateOpen(false);
        setEditingBreed(null);
        setSelectedBreed(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen, selectedBreed, submitting]);

  // Incluye la especie actual de la raza si estuviera inactiva, para no perder la selección al editar.
  const modalSpeciesOptions = useMemo(() => {
    if (!editingBreed?.species) return species;
    if (species.some((option) => option.id === editingBreed.speciesId)) return species;
    return [...species, editingBreed.species].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [editingBreed, species]);

  const handleRegister = async (draft: RegisterBreedDraft) => {
    setSubmitting(true);
    try {
      const created = await breedApi.registerBreed(draft);
      const selectedSpecies = species.find((option) => option.id === draft.speciesId);
      const enriched: Breed = created.species ? created : { ...created, species: selectedSpecies };
      setBreeds((current) => [...current, enriched].sort((a, b) => a.name.localeCompare(b.name, 'es')));
      showToast('Raza registrada exitosamente', 'success');
      setCreateOpen(false);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'Error al registrar raza', 'error');
      void loadSpecies();
      throw cause;
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (draft: RegisterBreedDraft) => {
    if (!editingBreed) return;
    setSubmitting(true);
    try {
      const updated = await breedApi.updateBreed(editingBreed.id, draft);
      setBreeds((current) =>
        current
          .map((item) => (item.id === updated.id ? updated : item))
          .sort((a, b) => a.name.localeCompare(b.name, 'es')),
      );
      showToast('Raza actualizada exitosamente', 'success');
      setEditingBreed(null);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'Error al actualizar raza', 'error');
      void loadSpecies();
      throw cause;
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeStatus = async (breed: Breed) => {
    const activating = !breed.isActive;
    const action = activating ? 'activar' : 'inactivar';
    const accepted = await confirm(
      `¿Confirmas que deseas ${action} la raza "${breed.name}"?`,
      `Sí, ${action}`,
      activating ? 'success' : 'danger',
    );
    if (!accepted) return;

    setChangingBreedId(breed.id);
    try {
      const updated = activating
        ? await breedApi.activateBreed(breed.id)
        : await breedApi.inactivateBreed(breed.id);
      setBreeds((current) =>
        current.map((item) =>
          item.id === updated.id ? { ...item, isActive: updated.isActive, updatedAt: updated.updatedAt } : item,
        ),
      );
      showToast(activating ? 'Raza activada correctamente' : 'Raza inactivada correctamente', 'success');
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'No se pudo cambiar el estado de la raza', 'error');
    } finally {
      setChangingBreedId(null);
    }
  };

  return (
    <div>
      {canCreate && (
        <div className="species-toolbar">
          <button type="button" className="button button--primary" onClick={openCreateModal}>
            <PlusIcon size={16} />
            Nueva raza
          </button>
        </div>
      )}

      <div className="catalog-toolbar breeds-filters">
        <label className="search-field">
          <PawIcon size={15} />
          <input
            type="search"
            aria-label="Buscar raza por nombre"
            placeholder="Buscar raza por nombre"
            maxLength={SEARCH_MAX}
            value={search}
            onChange={(event) => setSearch(event.target.value.slice(0, SEARCH_MAX))}
          />
        </label>
        <select
          className="breeds-filters__species"
          aria-label="Filtrar por especie"
          value={speciesFilter}
          onChange={(event) => setSpeciesFilter(event.target.value)}
        >
          <option value="">Todas las especies</option>
          {filterSpecies.map((option) => (
            <option key={option.id} value={option.id}>
              {option.isActive ? option.name : `${option.name} (inactiva)`}
            </option>
          ))}
        </select>
      </div>

      {listLoading ? (
        <div className="empty-state">Cargando razas…</div>
      ) : listError ? (
        <div className="inline-notice inline-notice--error" role="alert">{listError}</div>
      ) : breeds.length === 0 && hasFilters ? (
        <div className="catalog-empty" role="status">
          <span className="catalog-empty__icon">
            <PawIcon size={22} />
          </span>
          <strong>{NO_BREEDS_FOUND}</strong>
          <p>Prueba con otro nombre o selecciona otra especie.</p>
        </div>
      ) : breeds.length === 0 ? (
        <div className="catalog-empty" role="status">
          <span className="catalog-empty__icon">
            <PawIcon size={22} />
          </span>
          <strong>No hay razas registradas</strong>
          <p>Registra una nueva raza asociada a una especie activa para comenzar.</p>
        </div>
      ) : (
        <div className="catalog-card">
          <div className="catalog-card__heading">
            <div className="species-card__title">
              <span className="species-card__icon" aria-hidden="true">
                <PawIcon size={18} />
              </span>
              <div>
                <h3>Razas registradas</h3>
                <p>Razas disponibles por especie para clasificar a los pacientes de la clínica.</p>
              </div>
            </div>
            <span className="species-count-badge">
              {breeds.length} {breeds.length === 1 ? 'raza' : 'razas'}
            </span>
          </div>
          <div className="product-table-wrap">
            <table className="product-table breeds-table" aria-label="Razas">
              <thead>
                <tr>
                  <th className="breeds-table__name">Nombre</th>
                  <th className="breeds-table__species">Especie</th>
                  <th className="breeds-table__description">Descripción</th>
                  <th className="breeds-table__date">Actualizada</th>
                  <th className="breeds-table__status">Estado</th>
                  {showActions && <th className="breeds-table__actions">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {breeds.map((item) => (
                  <tr key={item.id}>
                    <td className="breeds-table__name">
                      <div className="species-name-cell">
                        <span className="species-row-icon" aria-hidden="true">
                          <PawIcon size={15} />
                        </span>
                        <button
                          type="button"
                          className="breeds-name-link"
                          aria-label={`Ver detalle de ${item.name}`}
                          onClick={() => setSelectedBreed(item)}
                        >
                          <strong>{item.name}</strong>
                        </button>
                      </div>
                    </td>
                    <td className="breeds-table__species">
                      <span className="code-pill">{item.species?.name ?? '—'}</span>
                    </td>
                    <td className="breeds-table__description">
                      {item.description ? (
                        <span className="species-desc-cell">
                          <NoteIcon />
                          <span>{item.description}</span>
                        </span>
                      ) : (
                        <span className="species-desc-empty">Sin descripción</span>
                      )}
                    </td>
                    <td className="breeds-table__date">
                      <span className="species-date-cell">
                        <CalendarIcon />
                        <span>{formatShortDate(item.updatedAt)}</span>
                      </span>
                    </td>
                    <td className="breeds-table__status">
                      <span className={`status-badge status-badge--${item.isActive ? 'active' : 'inactive'}`}>
                        {item.isActive ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    {showActions && (
                      <td className="breeds-table__actions">
                        {canUpdate && (
                          <button
                            type="button"
                            className="species-icon-btn"
                            aria-label={`Editar ${item.name}`}
                            title="Editar raza"
                            data-tooltip="Editar raza"
                            onClick={() => openEditModal(item)}
                          >
                            <EditIcon />
                          </button>
                        )}
                        {canChangeStatus && (
                          <button
                            type="button"
                            className="species-icon-btn"
                            aria-label={`${item.isActive ? 'Inactivar' : 'Activar'} ${item.name}`}
                            title={`${item.isActive ? 'Inactivar' : 'Activar'} raza`}
                            data-tooltip={`${item.isActive ? 'Inactivar' : 'Activar'} raza`}
                            disabled={changingBreedId === item.id}
                            onClick={() => void handleChangeStatus(item)}
                          >
                            <StatusIcon />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
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
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="breed-modal-title">
            <div className="modal-card__heading">
              <div>
                <span className="eyebrow">Catálogo</span>
                <h3 id="breed-modal-title">{editingBreed ? 'Editar raza' : 'Nueva raza'}</h3>
                <p>
                  {editingBreed
                    ? 'Actualiza el nombre, la especie asociada o la descripción de la raza.'
                    : 'Asóciala a una especie activa para agregarla al catálogo.'}
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
              {editingBreed ? (
                <BreedForm
                  key={editingBreed.id}
                  species={modalSpeciesOptions}
                  speciesLoading={speciesLoading}
                  initialValue={{
                    name: editingBreed.name,
                    speciesId: editingBreed.speciesId,
                    description: editingBreed.description,
                  }}
                  submitLabel="Guardar cambios"
                  onSubmit={handleUpdate}
                  onCancel={closeModal}
                  isLoading={submitting}
                />
              ) : (
                <BreedForm
                  species={species}
                  speciesLoading={speciesLoading}
                  onSubmit={handleRegister}
                  onCancel={closeModal}
                  isLoading={submitting}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {selectedBreed && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedBreed(null);
          }}
        >
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="breed-detail-title">
            <div className="modal-card__heading">
              <div>
                <span className="eyebrow">Detalle de raza</span>
                <h3 id="breed-detail-title">{selectedBreed.name}</h3>
                <p>Información registrada de la raza (solo lectura).</p>
              </div>
              <button type="button" className="modal-card__close" aria-label="Cerrar" onClick={() => setSelectedBreed(null)}>
                ×
              </button>
            </div>
            <div className="modal-card__body">
              <dl className="breed-detail">
                <div>
                  <dt>Nombre</dt>
                  <dd>{selectedBreed.name}</dd>
                </div>
                <div>
                  <dt>Especie</dt>
                  <dd>{selectedBreed.species?.name ?? '—'}</dd>
                </div>
                <div>
                  <dt>Descripción</dt>
                  <dd>{selectedBreed.description || 'Sin descripción'}</dd>
                </div>
                <div>
                  <dt>Estado</dt>
                  <dd>
                    <span className={`status-badge status-badge--${selectedBreed.isActive ? 'active' : 'inactive'}`}>
                      {selectedBreed.isActive ? 'Activa' : 'Inactiva'}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
