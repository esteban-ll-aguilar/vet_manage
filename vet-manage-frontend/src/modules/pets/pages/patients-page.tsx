import { useCallback, useEffect, useState } from 'react';
import { PawIcon, PlusIcon } from '../../../common/components/icons';
import { useToast } from '../../../common/components/toast-context';
import { useAuth } from '../../auth/auth-context';
import { PatientForm } from '../components/patient-form';
import { breedApi } from '../services/breed.service';
import { patientApi } from '../services/patient.service';
import { speciesApi } from '../services/species.service';
import type { RegisterPatientDraft, SpeciesOption } from '../types';
import './patients.css';

export function PatientsPage() {
  const { hasPermission } = useAuth();
  const { showToast } = useToast();
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

  return (
    <section className="patients-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Pacientes</span>
          <h2>Pacientes</h2>
          <p>Gestione los pacientes de la clínica y sus dueños.</p>
        </div>
        {hasPermission('pets:create') && (
          <button type="button" className="button button--primary" onClick={openModal}>
            <PlusIcon size={16} />
            Nuevo paciente
          </button>
        )}
      </div>

      <div className="patients-placeholder">
        <span className="patients-placeholder__icon"><PawIcon size={24} /></span>
        <strong>El listado de pacientes estará disponible próximamente</strong>
        <span>Desde aquí se podrán consultar los pacientes registrados.</span>
      </div>

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
