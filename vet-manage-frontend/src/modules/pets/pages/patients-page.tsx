import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { PawIcon, PlusIcon, SearchIcon } from '../../../common/components/icons';
import { useToast } from '../../../common/components/toast-context';
import { useAuth } from '../../auth/auth-context';
import { PatientForm } from '../components/patient-form';
import {
  EMPTY_RESULT_MESSAGE,
  usePatientQuery,
} from '../hooks/use-patient-query';
import { breedApi } from '../services/breed.service';
import { patientApi } from '../services/patient.service';
import { speciesApi } from '../services/species.service';
import {
  GENDER_LABELS,
  REPRODUCTIVE_STATUS_LABELS,
  type PatientSearchItem,
  type PatientStatus,
  type RegisterPatientDraft,
  type SpeciesOption,
} from '../types';
import './patients.css';

const statusLabels: Record<PatientStatus, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  DEACTIVATED: 'De baja',
};

const statusClasses: Record<PatientStatus, string> = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DEACTIVATED: 'deactivated',
};

export function PatientsPage() {
  const { hasPermission } = useAuth();
  const { showToast } = useToast();
  const {
    search,
    setSearch,
    result,
    loading,
    error,
    validationError,
    setValidationError,
    runSearch,
    clearSearch,
    goToPage,
    totalPages,
  } = usePatientQuery();
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchItem | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [species, setSpecies] = useState<SpeciesOption[]>([]);
  const [speciesLoading, setSpeciesLoading] = useState(false);
  // Cambia la key del formulario para empezar vacío cada vez que se abre el modal.
  const [formKey, setFormKey] = useState(0);

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

  const loadBreeds = useCallback((speciesId: string) => breedApi.listActiveBreeds(speciesId), []);
  const searchClients = useCallback((term: string) => patientApi.searchActiveClients(term), []);

  const openModal = () => {
    setFormKey((key) => key + 1);
    setModalOpen(true);
    void loadSpecies();
  };

  const closeModal = useCallback(() => {
    if (!saving) setModalOpen(false);
  }, [saving]);

  // Escape cierra el modal, salvo mientras se guarda.
  useEffect(() => {
    if (!isModalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, closeModal]);

  const handleRegister = async (draft: RegisterPatientDraft) => {
    setSaving(true);
    try {
      await patientApi.registerPatient(draft);
      showToast('Paciente registrado exitosamente', 'success');
      setModalOpen(false);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'Error al registrar el paciente', 'error');
      throw cause;
    } finally {
      setSaving(false);
    }
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    runSearch();
  };

  return (
    <section className="patients-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Pacientes</span>
          <h2>Pacientes</h2>
          <p>Consulte los pacientes registrados y seleccione uno para ver su ficha.</p>
        </div>
        {hasPermission('pets:create') && (
          <button type="button" className="button button--primary" onClick={openModal}>
            <PlusIcon size={16} />
            Nuevo paciente
          </button>
        )}
      </div>

      <form className="patients-filters" onSubmit={submitSearch}>
        <label className="search-field patients-filter">
          <SearchIcon size={15} />
          <input
            aria-label="Buscar pacientes"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              if (validationError) setValidationError(null);
            }}
            placeholder="Nombre, código, cédula o cliente"
          />
        </label>
        <div className="patients-filter-actions">
          <button className="button button--secondary patients-search-button" type="submit">Buscar</button>
          <button className="button button--ghost" type="button" onClick={clearSearch}>Limpiar búsqueda</button>
        </div>
      </form>

      {validationError && <div className="inline-notice inline-notice--error" role="alert">{validationError}</div>}

      <div className="catalog-card">
        {loading ? (
          <div className="empty-state">Cargando pacientes…</div>
        ) : error ? (
          <div className="inline-notice inline-notice--error" role="alert">{error}</div>
        ) : result.items.length === 0 ? (
          <div className="empty-state patients-empty-state">
            <strong>{EMPTY_RESULT_MESSAGE}</strong>
          </div>
        ) : (
          <div className="product-table-wrap">
            <table className="product-table patients-table" aria-label="Pacientes">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Especie</th>
                  <th>Cliente</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((patient) => (
                  <tr
                    key={patient.id}
                    onClick={() => setSelectedPatient(patient)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedPatient(patient);
                      }
                    }}
                    tabIndex={0}
                  >
                    <td><span className="code-pill">{patient.code}</span></td>
                    <td>
                      <button
                        type="button"
                        className="patients-row-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedPatient(patient);
                        }}
                      >
                        {patient.name}
                      </button>
                    </td>
                    <td>{patient.species.name} · {patient.breed.name}</td>
                    <td>{patient.client.firstName} {patient.client.lastName}</td>
                    <td>
                      <span className={`status-badge status-badge--${statusClasses[patient.status]}`}>
                        {statusLabels[patient.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="patients-pagination">
        <span>{result.total} pacientes</span>
        <div className="patients-pagination__controls">
          <button
            className="button button--ghost button--small"
            type="button"
            disabled={loading || result.page <= 1}
            onClick={() => goToPage(result.page - 1)}
          >
            Anterior
          </button>
          <span>Página {result.page} de {totalPages}</span>
          <button
            className="button button--ghost button--small"
            type="button"
            disabled={loading || result.page >= totalPages}
            onClick={() => goToPage(result.page + 1)}
          >
            Siguiente
          </button>
        </div>
      </div>

      {selectedPatient && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedPatient(null);
          }}
        >
          <div className="modal-card patient-detail" role="dialog" aria-modal="true" aria-labelledby="patient-detail-title">
            <div className="modal-card__heading">
              <div className="patient-modal__title">
                <span className="patient-modal__icon"><PawIcon size={20} /></span>
                <div>
                  <h3 id="patient-detail-title">Ficha de {selectedPatient.name}</h3>
                  <p>{selectedPatient.code} · Solo lectura</p>
                </div>
              </div>
              <button
                type="button"
                className="modal-card__close"
                aria-label="Cerrar ficha"
                onClick={() => setSelectedPatient(null)}
              >
                ×
              </button>
            </div>

            <div className="modal-card__body">
              <dl className="patient-detail__grid">
                <div><dt>Nombre</dt><dd>{selectedPatient.name}</dd></div>
                <div><dt>Código</dt><dd>{selectedPatient.code}</dd></div>
                <div><dt>Especie</dt><dd>{selectedPatient.species.name}</dd></div>
                <div><dt>Raza</dt><dd>{selectedPatient.breed.name}</dd></div>
                <div>
                  <dt>Cliente</dt>
                  <dd>{selectedPatient.client.firstName} {selectedPatient.client.lastName}</dd>
                </div>
                <div><dt>Cédula del cliente</dt><dd>{selectedPatient.client.identification}</dd></div>
                <div>
                  <dt>Estado</dt>
                  <dd>
                    <span className={`status-badge status-badge--${statusClasses[selectedPatient.status]}`}>
                      {statusLabels[selectedPatient.status]}
                    </span>
                  </dd>
                </div>
                <div><dt>Sexo</dt><dd>{GENDER_LABELS[selectedPatient.gender]}</dd></div>
                <div><dt>Fecha de nacimiento</dt><dd>{selectedPatient.birthDate}</dd></div>
                <div><dt>Peso (kg)</dt><dd>{selectedPatient.weightKg}</dd></div>
                <div><dt>Talla (cm)</dt><dd>{selectedPatient.heightCm}</dd></div>
                <div>
                  <dt>Estado reproductivo</dt>
                  <dd>{REPRODUCTIVE_STATUS_LABELS[selectedPatient.reproductiveStatus]}</dd>
                </div>
                <div><dt>Color</dt><dd>{selectedPatient.color ?? 'No registrado'}</dd></div>
              </dl>
              <div className="patient-detail__actions">
                <button type="button" className="button button--secondary" onClick={() => setSelectedPatient(null)}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}
        >
          <div className="modal-card patient-modal" role="dialog" aria-modal="true" aria-labelledby="patient-modal-title">
            <div className="modal-card__heading">
              <div className="patient-modal__title">
                <span className="patient-modal__icon"><PawIcon size={20} /></span>
                <div>
                  <h3 id="patient-modal-title">Datos del paciente</h3>
                  <p>El código identificador se asigna automáticamente al guardar.</p>
                </div>
              </div>
              <button type="button" className="modal-card__close" aria-label="Cerrar" onClick={closeModal} disabled={saving}>
                ×
              </button>
            </div>

            <div className="modal-card__body">
              <PatientForm
                key={formKey}
                species={species}
                speciesLoading={speciesLoading}
                loadBreeds={loadBreeds}
                searchClients={searchClients}
                onSubmit={handleRegister}
                onCancel={closeModal}
                isLoading={saving}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
