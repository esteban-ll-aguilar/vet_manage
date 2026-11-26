import type { ReactNode } from 'react';
import logo from '../../../assets/logo.jpeg';
import './login-page.css';

const CURRENT_YEAR = new Date().getFullYear();

// Panel con el diseño de la pantalla de inicio de sesión, para las pantallas de recuperación (HU-58).
export function PasswordRecoveryLayout({ eyebrow, title, subtitle, children }: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="login-screen login-screen--single">
      <section className="login-panel" aria-labelledby="recovery-title">
        <div className="login-form-wrap">
          <img className="login-mobile-logo" src={logo} alt="VetManage" />
          <span className="eyebrow">{eyebrow}</span>
          <h1 id="recovery-title">{title}</h1>
          <p className="login-subtitle">{subtitle}</p>
          {children}
        </div>
        <footer className="login-footer">© {CURRENT_YEAR} VetManage · Gestión veterinaria</footer>
      </section>
    </main>
  );
}

export function RecoveryAlert({ kind, children }: { kind: 'error' | 'success' | 'warning'; children: ReactNode }) {
  return (
    <div className={`login-alert login-alert--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <p>{children}</p>
    </div>
  );
}

export function RecoveryField({ id, label, error, invalid, children }: {
  id: string;
  label: string;
  error?: string | null;
  invalid?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="login-field">
      <label className="login-field__label" htmlFor={id}>{label}</label>
      <span className={`login-input${invalid || error ? ' login-input--invalid' : ''}`}>{children}</span>
      {error && <small id={`${id}-error`} className="login-field__error">{error}</small>}
    </div>
  );
}
