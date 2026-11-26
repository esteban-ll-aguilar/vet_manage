import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../../../infrastructure/api/http-client';
import { PASSWORD_POLICY, RECOVERY_MESSAGES } from '../password-recovery-rules';
import { authApi } from '../services/auth-api';
import { PasswordRecoveryLayout, RecoveryAlert, RecoveryField } from './password-recovery-layout';

type LinkState = 'checking' | 'valid' | 'expired' | 'invalid' | 'unreachable';

const LINK_CODES: Record<string, LinkState> = {
  PASSWORD_RESET_LINK_EXPIRED: 'expired',
  PASSWORD_RESET_LINK_INVALID: 'invalid',
};

// Estado del enlace según la respuesta de la API: 410 vencido, 400 no válido.
function linkStateFrom(cause: unknown): LinkState | null {
  if (!(cause instanceof ApiError)) return null;
  if (cause.code && LINK_CODES[cause.code]) return LINK_CODES[cause.code];
  if (cause.status === 410) return 'expired';
  return null;
}

// Restablecimiento con el enlace recibido por correo (HU-58).
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token')?.trim() ?? '';
  const [linkState, setLinkState] = useState<LinkState>(token ? 'checking' : 'invalid');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [policyChecked, setPolicyChecked] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    let active = true;
    authApi
      .validatePasswordReset(token)
      .then(() => active && setLinkState('valid'))
      .catch((cause: unknown) => {
        if (!active) return;
        const state = linkStateFrom(cause);
        setLinkState(state ?? (cause instanceof ApiError && cause.status === 400 ? 'invalid' : 'unreachable'));
      });
    return () => {
      active = false;
    };
  }, [token]);

  const policyError = policyChecked && newPassword && !PASSWORD_POLICY.test(newPassword) ? RECOVERY_MESSAGES.weak : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPolicyChecked(true);
    if (!newPassword.trim() || !confirmPassword.trim()) return setFormError(RECOVERY_MESSAGES.missing);
    if (newPassword !== confirmPassword) return setFormError(RECOVERY_MESSAGES.mismatch);
    // El mensaje de la política se muestra bajo el campo.
    if (!PASSWORD_POLICY.test(newPassword)) return setFormError(null);

    setSubmitting(true);
    setFormError(null);
    try {
      await authApi.confirmPasswordReset({ token, newPassword, confirmPassword });
      navigate('/login', { replace: true, state: { passwordReset: true } });
    } catch (cause) {
      const state = linkStateFrom(cause);
      if (state) setLinkState(state);
      else setFormError(cause instanceof ApiError ? cause.message : RECOVERY_MESSAGES.connection);
      setSubmitting(false);
    }
  }

  if (linkState !== 'valid') {
    const message = {
      checking: 'Verificando el enlace…',
      expired: RECOVERY_MESSAGES.expired,
      invalid: RECOVERY_MESSAGES.invalidLink,
      unreachable: RECOVERY_MESSAGES.connection,
    }[linkState];
    return (
      <PasswordRecoveryLayout eyebrow="Recuperar acceso" title="Restablecer contraseña" subtitle="Cree una nueva contraseña para su cuenta.">
        {linkState === 'checking' ? (
          <p className="login-recovery-state" role="status">{message}</p>
        ) : (
          <>
            <RecoveryAlert kind={linkState === 'expired' ? 'warning' : 'error'}>{message}</RecoveryAlert>
            <div className="login-recovery-actions">
              <Link className="login-submit" to="/forgot-password">Solicitar un nuevo enlace</Link>
              <p className="login-help">
                <Link className="login-help__link" to="/login">Volver a iniciar sesión</Link>
              </p>
            </div>
          </>
        )}
      </PasswordRecoveryLayout>
    );
  }

  const missing = formError === RECOVERY_MESSAGES.missing;
  return (
    <PasswordRecoveryLayout eyebrow="Recuperar acceso" title="Restablecer contraseña" subtitle="Cree una nueva contraseña para su cuenta.">
      {formError && <RecoveryAlert kind="error">{formError}</RecoveryAlert>}

      <form className="login-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        <RecoveryField id="reset-new-password" label="Nueva contraseña" error={policyError} invalid={missing && !newPassword.trim()}>
          <input
            id="reset-new-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            disabled={submitting}
            onChange={(event) => {
              setNewPassword(event.target.value);
              setFormError(null);
            }}
            onBlur={() => setPolicyChecked(true)}
            aria-invalid={Boolean(policyError)}
            aria-describedby={policyError ? 'reset-new-password-error' : 'reset-new-password-hint'}
          />
        </RecoveryField>
        {!policyError && (
          <small id="reset-new-password-hint" className="login-recovery-hint">
            Mínimo 8 caracteres, con una mayúscula, una minúscula y un número.
          </small>
        )}

        <RecoveryField id="reset-confirm-password" label="Confirmar contraseña" invalid={missing && !confirmPassword.trim()}>
          <input
            id="reset-confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            disabled={submitting}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              setFormError(null);
            }}
          />
        </RecoveryField>

        <button className="login-submit" type="submit" disabled={submitting}>
          {submitting && <span className="login-spinner" aria-hidden="true" />}
          {submitting ? 'Guardando…' : 'Guardar'}
        </button>
      </form>
    </PasswordRecoveryLayout>
  );
}
