import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ApiError } from '../../../infrastructure/api/http-client';
import { EMAIL_PATTERN, RECOVERY_MESSAGES } from '../password-recovery-rules';
import { authApi } from '../services/auth-api';
import { PasswordRecoveryLayout, RecoveryAlert, RecoveryField } from './password-recovery-layout';

// Solicitud del enlace de recuperación (HU-58): la respuesta es la misma exista o no la cuenta.
export function ForgotPasswordPage() {
  const location = useLocation();
  const [email, setEmail] = useState(() => (location.state as { email?: string } | null)?.email ?? '');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !EMAIL_PATTERN.test(trimmed)) {
      setEmailError(RECOVERY_MESSAGES.invalidEmail);
      return;
    }

    setSubmitting(true);
    setApiError(null);
    try {
      await authApi.requestPasswordReset(trimmed);
      setSent(true);
    } catch (cause) {
      setApiError(cause instanceof ApiError ? cause.message : RECOVERY_MESSAGES.connection);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PasswordRecoveryLayout
      eyebrow="Recuperar acceso"
      title="¿Olvidó su contraseña?"
      subtitle="Ingrese el correo de su cuenta y le enviaremos un enlace para crear una nueva."
    >
      {sent && <RecoveryAlert kind="success">{RECOVERY_MESSAGES.requested}</RecoveryAlert>}
      {apiError && <RecoveryAlert kind="error">{apiError}</RecoveryAlert>}

      <form className="login-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        <RecoveryField id="forgot-email" label="Correo electrónico" error={emailError}>
          <input
            id="forgot-email"
            type="email"
            inputMode="email"
            autoComplete="username"
            value={email}
            disabled={sent}
            onChange={(event) => {
              setEmail(event.target.value);
              setEmailError(null);
            }}
            placeholder="nombre@clinica.com"
            aria-invalid={Boolean(emailError)}
            aria-describedby={emailError ? 'forgot-email-error' : undefined}
          />
        </RecoveryField>

        <div className="login-recovery-actions">
          <button className="login-submit" type="submit" disabled={submitting || sent}>
            {submitting && <span className="login-spinner" aria-hidden="true" />}
            {submitting ? 'Enviando…' : 'Enviar enlace'}
          </button>
          <p className="login-help">
            <Link className="login-help__link" to="/login">Volver a iniciar sesión</Link>
          </p>
        </div>
      </form>
    </PasswordRecoveryLayout>
  );
}
