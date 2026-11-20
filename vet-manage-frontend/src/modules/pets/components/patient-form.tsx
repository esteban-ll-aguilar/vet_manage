import { useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  CalendarIcon, GenderIcon, HeartIcon, PaletteIcon, PawIcon, RulerIcon, ScaleIcon, TagIcon, UserIcon,
} from '../../../common/components/icons';
import { ApiError } from '../../../infrastructure/api/http-client';
import { emptyPatientForm, maskBirthDate, validatePatientDraft } from '../schemas/patient';
import type { PatientField, PatientFieldErrors, PatientFormInput } from '../schemas/patient';
import { GENDER_LABELS, REPRODUCTIVE_STATUS_LABELS } from '../types';
import type { ClientOption, RegisterPatientDraft, SpeciesOption } from '../types';
import { ClientPicker } from './client-picker';

interface PatientFormProps {
  species: SpeciesOption[];
  speciesLoading?: boolean;
  loadBreeds: (speciesId: string) => Promise<SpeciesOption[]>;
  searchClients: (term: string) => Promise<ClientOption[]>;
  onSubmit: (draft: RegisterPatientDraft) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const FIELDS = new Set<string>(Object.keys(emptyPatientForm));

export function PatientForm({
  species, speciesLoading = false, loadBreeds, searchClients, onSubmit, onCancel, isLoading = false,
}: PatientFormProps) {
  const [form, setForm] = useState<PatientFormInput>(emptyPatientForm);
  const [client, setClient] = useState<ClientOption | null>(null);
  const [breeds, setBreeds] = useState<SpeciesOption[]>([]);
  const [breedsLoading, setBreedsLoading] = useState(false);
  const [errors, setErrors] = useState<PatientFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Especie de la última carga de razas, para ignorar respuestas que lleguen tarde.
  const latestSpecies = useRef('');

  const update = (field: PatientField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  // Al cambiar la especie se limpia la raza y se cargan las razas activas de la nueva especie.
  const changeSpecies = (speciesId: string) => {
    update('speciesId', speciesId);
    setForm((current) => ({ ...current, breedId: '' }));
    setBreeds([]);
    latestSpecies.current = speciesId;
    if (!speciesId) return;

    setBreedsLoading(true);
    loadBreeds(speciesId)
      .then((found) => { if (latestSpecies.current === speciesId) setBreeds(found); })
      .catch(() => { if (latestSpecies.current === speciesId) setBreeds([]); })
      .finally(() => { if (latestSpecies.current === speciesId) setBreedsLoading(false); });
  };

  const selectClient = (selected: ClientOption | null) => {
    setClient(selected);
    update('clientId', selected?.id ?? '');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validation = validatePatientDraft(form);
    if (!validation.valid) {
      setErrors(validation.errors);
      setFormError(validation.message);
      return;
    }

    setErrors({});
    setFormError(null);
    try {
      await onSubmit(validation.value);
    } catch (cause) {
      // El backend devuelve en `errors` los campos que hay que resaltar.
      const message = cause instanceof Error ? cause.message : 'Error al registrar el paciente';
      if (cause instanceof ApiError) {
        const fieldErrors: PatientFieldErrors = {};
        for (const field of cause.errors) if (FIELDS.has(field)) fieldErrors[field as PatientField] = message;
        setErrors(fieldErrors);
      }
      setFormError(message);
    }
  };

  const noSpecies = !speciesLoading && species.length === 0;
  const busy = isLoading;

  return (
    <form className="patient-form" onSubmit={handleSubmit} noValidate>
      <section className="patient-form__section">
        {/* Tres columnas iguales: identificación, datos biológicos y medidas. */}
        <div className="patient-form__grid">
          <Field id="patient-name" label="Nombre" required error={errors.name} icon={<PawIcon size={16} />}>
            <input id="patient-name" value={form.name} maxLength={100} placeholder="Ej. Firulais" disabled={busy}
              aria-invalid={Boolean(errors.name)} onChange={(event) => update('name', event.target.value)} />
          </Field>

          <Field id="patient-species" label="Especie" required error={errors.speciesId} icon={<PawIcon size={16} />}
            hint={noSpecies ? 'No hay especies activas registradas' : undefined}>
            <select id="patient-species" value={form.speciesId} disabled={busy || speciesLoading || noSpecies}
              aria-invalid={Boolean(errors.speciesId)} onChange={(event) => changeSpecies(event.target.value)}>
              <option value="">{speciesLoading ? 'Cargando especies...' : 'Selecciona una especie'}</option>
              {species.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </Field>

          <Field id="patient-breed" label="Raza" required error={errors.breedId} icon={<TagIcon size={16} />}
            hint={form.speciesId && !breedsLoading && breeds.length === 0 ? 'La especie no tiene razas activas' : undefined}>
            <select id="patient-breed" value={form.breedId} disabled={busy || !form.speciesId || breedsLoading}
              aria-invalid={Boolean(errors.breedId)} onChange={(event) => update('breedId', event.target.value)}>
              <option value="">
                {!form.speciesId ? 'Primero elige la especie' : breedsLoading ? 'Cargando razas...' : 'Selecciona una raza'}
              </option>
              {breeds.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </Field>

          <Field id="patient-gender" label="Sexo" required error={errors.gender} icon={<GenderIcon size={16} />}>
            <select id="patient-gender" value={form.gender} disabled={busy} aria-invalid={Boolean(errors.gender)}
              onChange={(event) => update('gender', event.target.value)}>
              <option value="">Selecciona el sexo</option>
              {Object.entries(GENDER_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>

          <Field id="patient-birth-date" label="Fecha de nacimiento" required error={errors.birthDate}
            icon={<CalendarIcon size={16} />}>
            <input id="patient-birth-date" value={form.birthDate} inputMode="numeric" placeholder="DD-MM-YYYY" maxLength={10}
              disabled={busy} aria-invalid={Boolean(errors.birthDate)}
              onChange={(event) => update('birthDate', maskBirthDate(event.target.value))} />
          </Field>

          <Field id="patient-reproductive-status" label="Estado reproductivo" required error={errors.reproductiveStatus}
            icon={<HeartIcon size={16} />}>
            <select id="patient-reproductive-status" value={form.reproductiveStatus} disabled={busy}
              aria-invalid={Boolean(errors.reproductiveStatus)}
              onChange={(event) => update('reproductiveStatus', event.target.value)}>
              <option value="">Selecciona el estado</option>
              {Object.entries(REPRODUCTIVE_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>

          <Field id="patient-weight" label="Peso (kg)" required error={errors.weightKg} icon={<ScaleIcon size={16} />}>
            <input id="patient-weight" value={form.weightKg} inputMode="decimal" placeholder="Ej. 12.5" disabled={busy}
              aria-invalid={Boolean(errors.weightKg)} onChange={(event) => update('weightKg', event.target.value)} />
          </Field>

          <Field id="patient-height" label="Talla (cm)" required error={errors.heightCm} icon={<RulerIcon size={16} />}>
            <input id="patient-height" value={form.heightCm} inputMode="decimal" placeholder="Ej. 45" disabled={busy}
              aria-invalid={Boolean(errors.heightCm)} onChange={(event) => update('heightCm', event.target.value)} />
          </Field>

          <Field id="patient-color" label="Color" optional error={errors.color} icon={<PaletteIcon size={16} />}>
            <input id="patient-color" value={form.color} maxLength={50} placeholder="Ej. Café con blanco" disabled={busy}
              onChange={(event) => update('color', event.target.value)} />
          </Field>
        </div>
      </section>

      <section className="patient-form__section">
        <header className="patient-form__heading">
          <span className="patient-form__heading-icon"><UserIcon size={16} /></span>
          <div>
            <h4>Dueño</h4>
            <p>Solo se muestran clientes activos.</p>
          </div>
        </header>
        <ClientPicker value={client} onChange={selectClient} search={searchClients} error={errors.clientId} disabled={busy} />
      </section>

      {formError && <p className="field-error patient-form__error" role="alert">{formError}</p>}

      <div className="patient-form__actions">
        <button type="button" className="button button--ghost" onClick={onCancel} disabled={busy}>Cancelar</button>
        <button type="submit" className="button button--primary" disabled={busy || speciesLoading}>
          {busy ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}

function Field({ id, label, required, optional, hint, error, icon, children }: {
  id: string; label: string; required?: boolean; optional?: boolean; hint?: string; error?: string; icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="field patient-field">
      <label htmlFor={id}>
        {label}{required && <b> *</b>}{optional && <small className="patient-field__optional"> (opcional)</small>}
      </label>
      <div className="patient-field__control">
        {icon}
        {children}
      </div>
      {hint && !error && <small>{hint}</small>}
      {error && <small className="field-error">{error}</small>}
    </div>
  );
}
