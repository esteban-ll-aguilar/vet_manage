import { useState } from 'react';
import { validateSpeciesDraft } from '../schemas/species';
import type { RegisterSpeciesDraft } from '../types';

interface SpeciesFormProps {
  onSubmit: (draft: RegisterSpeciesDraft) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  initialValue?: { name: string; description?: string | null };
  submitLabel?: string;
}

export function SpeciesForm({
  onSubmit,
  onCancel,
  isLoading = false,
  initialValue,
  submitLabel = 'Guardar especie',
}: SpeciesFormProps) {
  const [name, setName] = useState(initialValue?.name ?? '');
  const [description, setDescription] = useState(initialValue?.description ?? '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validation = validateSpeciesDraft({ name, description });

    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setError(null);
    try {
      await onSubmit(validation.value);
      if (!initialValue) {
        setName('');
        setDescription('');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error al guardar la especie');
    }
  };

  const handleReset = () => {
    setName(initialValue?.name ?? '');
    setDescription(initialValue?.description ?? '');
    setError(null);
    onCancel();
  };

  return (
    <form className="species-form" onSubmit={handleSubmit}>
      <label className="field" htmlFor="species-name">
        <span>Nombre de la especie <b>*</b></span>
        <input
          id="species-name"
          type="text"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (error) setError(null);
          }}
          disabled={isLoading}
          placeholder="Ej. Canino, Felino, Bovino..."
          aria-invalid={Boolean(error)}
        />
        {error ? <small className="field-error">{error}</small> : <small>Así aparecerá en el catálogo de pacientes.</small>}
      </label>

      <label className="field" htmlFor="species-description">
        <span>Descripción <small>Opcional</small></span>
        <textarea
          id="species-description"
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={isLoading}
          placeholder="Observaciones o características generales..."
        />
      </label>

      <div className="species-form__actions">
        <button type="button" className="button button--ghost" onClick={handleReset} disabled={isLoading}>
          Cancelar
        </button>
        <button type="submit" className="button button--primary" disabled={isLoading}>
          {isLoading ? 'Guardando...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
