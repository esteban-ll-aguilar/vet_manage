import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CheckIcon } from '../../../common/components/icons';
import type { Branch } from '../types';
import {
  MOTIVO_MAX,
  SLOT_OPTIONS,
  mapApiErrorsToFields,
  validateBlockForm,
  type BlockFieldErrors,
  type BlockFormInput,
} from './block-form-schema';
import type { ScheduleBlockDraft, ScheduleBlockScope, Veterinarian } from './types';

type BlockFormProps = {
  branches: Branch[];
  veterinarians: Veterinarian[];
  // Debe lanzar el error de la API para mostrarlo en el formulario.
  onSubmit: (draft: ScheduleBlockDraft) => Promise<void>;
  // Ruta a la que vuelve el botón Cancelar; sin ella no se muestra.
  cancelTo?: string;
};

type FormProblem = { message: string; details: string[] } | null;

const EMPTY: BlockFormInput = {
  sucursalId: '', alcance: 'VETERINARIO', veterinarioId: '', fecha: '', horaInicio: '', horaFin: '', motivo: '',
};

export function BlockForm({ branches, veterinarians, onSubmit, cancelTo }: BlockFormProps) {
  const [form, setForm] = useState<BlockFormInput>(EMPTY);
  const [errors, setErrors] = useState<BlockFieldErrors>({});
  const [problem, setProblem] = useState<FormProblem>(null);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof BlockFormInput>(field: K, value: BlockFormInput[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setProblem(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const validation = validateBlockForm(form);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setProblem(null);
    setSaving(true);
    try {
      await onSubmit(validation.value);
      // Conserva la sucursal y el alcance para registrar otro bloqueo parecido.
      setForm({ ...EMPTY, sucursalId: form.sucursalId, alcance: form.alcance });
    } catch (cause) {
      const apiError = cause as { message?: string; errors?: string[] };
      const messages = apiError.errors?.length ? apiError.errors : [apiError.message ?? ''];
      const fieldErrors = mapApiErrorsToFields(messages);
      if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
      // Citas afectadas, falta de permisos u otros errores se muestran sobre los botones.
      else setProblem({ message: apiError.message ?? 'No se pudo registrar el bloqueo.', details: apiError.errors ?? [] });
    } finally {
      setSaving(false);
    }
  }

  const scope = (value: ScheduleBlockScope, label: string) => (
    // El radio queda oculto pero sigue funcionando con teclado y lectores de pantalla.
    <label className="scope-option">
      <input className="scope-option__input" type="radio" name="alcance" value={value} checked={form.alcance === value} onChange={() => update('alcance', value)} />
      <span className="scope-option__label">{label}</span>
      <span className="scope-option__check" aria-hidden="true"><CheckIcon size={14} /></span>
    </label>
  );

  return (
    <form className="product-form" onSubmit={submit} noValidate>
      <div className="form-section">
        <div className="form-section__heading">
          <span className="section-number">01</span>
          <div><h3>Alcance</h3><p>Bloquea a un veterinario o a todos los veterinarios y consultorios de la sucursal.</p></div>
        </div>
        <div className="form-grid">
          <Field label="Sucursal" required error={errors.sucursalId}>
            <select value={form.sucursalId} onChange={(event) => update('sucursalId', event.target.value)} aria-invalid={Boolean(errors.sucursalId)}>
              <option value="">Selecciona una sucursal</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.nombre}</option>)}
            </select>
          </Field>
          <fieldset className="field scope-field">
            <legend>Aplica a</legend>
            <div className="scope-options">
              {scope('VETERINARIO', 'Un veterinario')}
              {scope('SUCURSAL', 'Toda la sucursal')}
            </div>
          </fieldset>
          {form.alcance === 'VETERINARIO' && (
            <Field className="form-grid__full" label="Veterinario" required error={errors.veterinarioId}>
              <select value={form.veterinarioId} onChange={(event) => update('veterinarioId', event.target.value)} aria-invalid={Boolean(errors.veterinarioId)}>
                <option value="">Selecciona un veterinario</option>
                {veterinarians.map((vet) => <option key={vet.id} value={vet.id}>{vet.nombre}</option>)}
              </select>
            </Field>
          )}
        </div>
      </div>

      <div className="form-section">
        <div className="form-section__heading">
          <span className="section-number">02</span>
          <div><h3>Horario</h3><p>El inicio y el fin van en punto o y media.</p></div>
        </div>
        <div className="form-grid">
          <Field className="form-grid__full" label="Fecha" required error={errors.fecha}>
            <input type="date" value={form.fecha} onChange={(event) => update('fecha', event.target.value)} aria-invalid={Boolean(errors.fecha)} />
          </Field>
          <Field label="Hora de inicio" required error={errors.horaInicio}>
            <select value={form.horaInicio} onChange={(event) => update('horaInicio', event.target.value)} aria-invalid={Boolean(errors.horaInicio)}>
              <option value="">--:--</option>
              {SLOT_OPTIONS.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
            </select>
          </Field>
          <Field label="Hora de fin" required error={errors.horaFin}>
            <select value={form.horaFin} onChange={(event) => update('horaFin', event.target.value)} aria-invalid={Boolean(errors.horaFin)}>
              <option value="">--:--</option>
              {SLOT_OPTIONS.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
            </select>
          </Field>
          <Field className="form-grid__full" label="Motivo" required error={errors.motivo}>
            <textarea rows={3} maxLength={MOTIVO_MAX} value={form.motivo} onChange={(event) => update('motivo', event.target.value)} placeholder="Ej. Permiso médico, Mantenimiento" aria-invalid={Boolean(errors.motivo)} />
          </Field>
        </div>
      </div>

      {problem && (
        <div className="form-problem" role="alert">
          <strong>{problem.message}</strong>
          {problem.details.length > 0 && <ul>{problem.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>}
        </div>
      )}

      <div className="form-actions">
        {cancelTo && <Link className="button button--ghost" to={cancelTo}>Cancelar</Link>}
        <button className="button button--primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Registrar bloqueo'}</button>
      </div>
    </form>
  );
}

function Field({ label, required, error, className = '', children }: { label: string; required?: boolean; error?: string; className?: string; children: ReactNode }) {
  return (
    <label className={`field ${className}`}>
      <span>{label}{required && <b> *</b>}</span>
      {children}
      {error && <small className="field-error" role="alert">{error}</small>}
    </label>
  );
}
