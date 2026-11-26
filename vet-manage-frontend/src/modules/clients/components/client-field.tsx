import type { ReactNode } from 'react';

type ClientFieldProps = {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  icon: ReactNode;
  className?: string;
  children: ReactNode;
};

// Campo de los formularios de clientes (registro HU-01 y edición HU-02): etiqueta, icono, ayuda y error.
export function ClientField({ label, required, hint, error, icon, className = '', children }: ClientFieldProps) {
  return (
    <label className={`field ${className}`}>
      <span>{label}{required && <b> *</b>}</span>
      <span className="input-icon">{icon}{children}</span>
      {hint && !error && <small>{hint}</small>}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}
