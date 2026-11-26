import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../../common/components/toast-context';
import { useAuth } from '../auth-context';
import { authApi } from '../services/auth-api';
import './change-password-page.css';

const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const MESSAGES = {
  missing: 'Complete los campos obligatorios',
  weak: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número',
  mismatch: 'Las contraseñas no coinciden',
  sameAsCurrent: 'La nueva contraseña debe ser diferente a la actual',
  updated: 'Contraseña actualizada correctamente',
} as const;

function ShieldLockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l7 3v5c0 4.5-3 8.4-7 10-4-1.6-7-5.5-7-10V6l7-3z" />
      <rect x="9" y="11" width="6" height="5" rx="1.2" />
      <path d="M10.5 11V9.5a1.5 1.5 0 0 1 3 0V11" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="15" r="4" />
      <path d="M10.85 12.15 19 4" />
      <path d="m18 5 2 2" />
      <path d="m15 8 2 2" />
    </svg>
  );
}

function AlertTriangleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.6 5.6A9.8 9.8 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.6 3.4M6.3 6.9C3.9 8.6 2.5 12 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4.2-1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
    </svg>
  );
}

export function ChangePasswordPage() {
  const { session, clearMustChangePassword } = useAuth();
  const { showToast } = useToast();
  const mustChange = Boolean(session?.mustChangePassword);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rules = [
    { label: 'Al menos 8 caracteres', met: newPassword.length >= 8 },
    { label: 'Una letra mayúscula', met: /[A-Z]/.test(newPassword) },
    { label: 'Una letra minúscula', met: /[a-z]/.test(newPassword) },
    { label: 'Un número', met: /\d/.test(newPassword) },
  ];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setError(MESSAGES.missing);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(MESSAGES.mismatch);
      return;
    }
    if (!PASSWORD_POLICY.test(newPassword)) {
      setError(MESSAGES.weak);
      return;
    }
    if (newPassword === currentPassword) {
      setError(MESSAGES.sameAsCurrent);
      return;
    }

    setSubmitting(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword, confirmPassword });
      clearMustChangePassword?.();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast(MESSAGES.updated, 'success');
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar la contraseña.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="change-password-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Seguridad de la cuenta</span>
          <h2>Cambiar contraseña</h2>
          <p>Actualice su contraseña para mantener protegida su cuenta en VetManage.</p>
        </div>
        {!mustChange && (
          <Link className="button button--ghost" to="/">Volver al inicio</Link>
        )}
      </div>

      <div className="catalog-card change-password-card">
        <div className="change-password-card__header">
          <div className="change-password-card__icon">
            <ShieldLockIcon />
          </div>
          <div className="change-password-card__meta">
            <h3>Credenciales de acceso</h3>
            <span>{session?.user.email ?? 'Cuenta autenticada'}</span>
          </div>
        </div>

        {mustChange && (
          <div className="change-password-banner" role="note">
            <span className="change-password-banner__icon">
              <AlertTriangleIcon />
            </span>
            <div>
              <strong>Cambio obligatorio en el primer ingreso</strong>
              <p>
                Su cuenta utiliza una contraseña temporal. Debe definir una nueva contraseña antes de acceder al resto del sistema.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="inline-notice inline-notice--error" role="alert">
            {error}
          </div>
        )}

        <form className="change-password-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
          <label className="field">
            <span>Contraseña actual</span>
            <div className="password-input-wrap">
              <span className="password-input-icon"><LockIcon /></span>
              <input
                type={showCurrent ? 'text' : 'password'}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="Ingrese su contraseña actual"
              />
              <button
                className="password-toggle-btn"
                type="button"
                aria-label={showCurrent ? 'Ocultar contraseña actual' : 'Mostrar contraseña actual'}
                onClick={() => setShowCurrent((v) => !v)}
              >
                {showCurrent ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </label>

          <label className="field">
            <span>Nueva contraseña</span>
            <div className="password-input-wrap">
              <span className="password-input-icon"><KeyIcon /></span>
              <input
                type={showNew ? 'text' : 'password'}
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Ingrese su nueva contraseña"
              />
              <button
                className="password-toggle-btn"
                type="button"
                aria-label={showNew ? 'Ocultar nueva contraseña' : 'Mostrar nueva contraseña'}
                onClick={() => setShowNew((v) => !v)}
              >
                {showNew ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </label>

          <ul className="password-rules" aria-label="Requisitos de la contraseña">
            {rules.map((rule) => (
              <li key={rule.label} className={`password-rule${rule.met ? ' password-rule--met' : ''}`}>
                <span className="password-rule__badge" aria-hidden="true">
                  {rule.met ? <CheckIcon /> : null}
                </span>
                {rule.label}
              </li>
            ))}
          </ul>

          <label className="field">
            <span>Confirmar nueva contraseña</span>
            <div className="password-input-wrap">
              <span className="password-input-icon"><KeyIcon /></span>
              <input
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repita la nueva contraseña"
              />
              <button
                className="password-toggle-btn"
                type="button"
                aria-label={showConfirm ? 'Ocultar confirmación' : 'Mostrar confirmación'}
                onClick={() => setShowConfirm((v) => !v)}
              >
                {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </label>

          <div className="change-password-actions">
            <button className="button button--primary change-password-submit" type="submit" disabled={submitting}>
              <CheckIcon />
              {submitting ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
