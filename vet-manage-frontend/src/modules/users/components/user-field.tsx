import type { ReactNode } from 'react';

type UserFieldProps = {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  icon: ReactNode;
  className?: string;
  children: ReactNode;
};

// Campo de los formularios de usuarios (registro HU-51 y edición HU-53): etiqueta, icono, ayuda y error.
export function UserField({ label, required, hint, error, icon, className = '', children }: UserFieldProps) {
  return (
    <label className={`field ${className}`}>
      <span>{label}{required && <b> *</b>}</span>
      <span className="input-icon">{icon}{children}</span>
      {hint && !error && <small>{hint}</small>}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}
