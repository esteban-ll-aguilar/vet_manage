import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import logo from '../../../assets/logo.jpeg';
import { ApiError } from '../../../infrastructure/api/http-client';
import { useAuth } from '../auth-context';
import './login-page.css';

const MISSING_FIELDS = 'Ingrese su correo y contraseña';
const INVALID_EMAIL = 'Ingrese un correo electrónico válido';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CURRENT_YEAR = new Date().getFullYear();
export const PASSWORD_RESET_DONE = 'Contraseña actualizada. Inicie sesión con su nueva contraseña';

type Feedback = { kind: 'error' | 'warning' | 'locked'; message: string };

const features = [
  { title: 'Historial clínico completo', text: 'Consultas, diagnósticos y recetas de cada paciente.' },
  { title: 'Vacunas y desparasitaciones', text: 'Control preventivo con fechas y próximas dosis.' },
  { title: 'Acceso según tu rol', text: 'Cada integrante ve solo lo que necesita.' },
];

// Tipo de aviso según el error devuelto por la API.
function toFeedback(cause: unknown): Feedback {
  if (!(cause instanceof ApiError)) {
    return { kind: 'error', message: 'No se pudo conectar con el servidor. Intente nuevamente.' };
  }
  if (cause.code === 'LOGIN_ACCOUNT_LOCKED') return { kind: 'locked', message: cause.message };
  if (cause.code === 'LOGIN_INVALID_CREDENTIALS' && /Le queda/.test(cause.message)) {
    return { kind: 'warning', message: cause.message };
  }
  return { kind: 'error', message: cause.message };
}

export function LoginPage() {
  const { status, session, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const navigationState = location.state as { from?: string; passwordReset?: boolean } | null;
  const from = navigationState?.from ?? '/';
  const passwordReset = Boolean(navigationState?.passwordReset);
  if (status === 'authenticated') {
    return <Navigate to={session?.mustChangePassword ? '/change-password' : from} replace />;
  }

  const trimmedEmail = email.trim();
  const emailError = emailTouched && trimmedEmail && !EMAIL_PATTERN.test(trimmedEmail) ? INVALID_EMAIL : null;
  const missing = feedback?.message === MISSING_FIELDS;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailTouched(true);
    if (!trimmedEmail || !password.trim()) {
      setFeedback({ kind: 'error', message: MISSING_FIELDS });
      return;
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setFeedback(null);
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const profile = await login({ email: trimmedEmail, password });
      navigate(profile.mustChangePassword ? '/change-password' : from, { replace: true });
    } catch (cause) {
      setPassword('');
      setFeedback(toFeedback(cause));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-screen">
      <aside className="login-showcase" aria-hidden="true">
        <div className="login-showcase__glow login-showcase__glow--one" />
        <div className="login-showcase__glow login-showcase__glow--two" />
        <div className="login-showcase__content">
          <img className="login-showcase__logo" src={logo} alt="" />
          <span className="login-showcase__eyebrow">Sistema integral veterinario</span>
          <h2>Todo el cuidado de tus pacientes, en un solo lugar.</h2>
          <ul className="login-features">
            {features.map((feature) => (
              <li key={feature.title}>
                <span className="login-features__icon"><CheckIcon /></span>
                <div>
                  <strong>{feature.title}</strong>
                  <small>{feature.text}</small>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="login-showcase__badge">
          <ShieldIcon />
          <span>Sesión protegida y cifrada</span>
        </div>
      </aside>

      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-form-wrap">
          <img className="login-mobile-logo" src={logo} alt="VetManage" />
          <span className="eyebrow">Bienvenido de nuevo</span>
          <h1 id="login-title">Inicia sesión</h1>
          <p className="login-subtitle">Ingresa con el correo y la contraseña de tu cuenta.</p>

          {passwordReset && !feedback && (
            <div className="login-alert login-alert--success" role="status">
              <span className="login-alert__icon"><CheckIcon /></span>
              <p>{PASSWORD_RESET_DONE}</p>
            </div>
          )}

          {feedback && (
            <div className={`login-alert login-alert--${feedback.kind}`} role="alert">
              <span className="login-alert__icon">{feedback.kind === 'locked' ? <LockIcon /> : <AlertIcon />}</span>
              <p>{feedback.message}</p>
            </div>
          )}

          <form className="login-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
            <Field
              label="Correo electrónico"
              icon={<MailIcon />}
              error={emailError}
              invalid={Boolean(emailError) || (missing && !trimmedEmail)}
            >
              <input
                id="login-email"
                type="email"
                inputMode="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onBlur={() => setEmailTouched(true)}
                placeholder="nombre@clinica.com"
                aria-describedby={emailError ? 'login-email-error' : undefined}
              />
            </Field>

            <Field label="Contraseña" icon={<LockIcon />} invalid={missing && !password.trim()}>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
              />
              <button
                className="login-input__toggle"
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </Field>

            <button className="login-submit" type="submit" disabled={submitting}>
              {submitting && <span className="login-spinner" aria-hidden="true" />}
              {submitting ? 'Ingresando…' : 'Iniciar sesión'}
            </button>
          </form>

          <p className="login-help">
            <Link className="login-help__link" to="/forgot-password" state={{ email: trimmedEmail }}>
              ¿Olvidó su contraseña?
            </Link>
          </p>
        </div>
        <footer className="login-footer">© {CURRENT_YEAR} VetManage · Gestión veterinaria</footer>
      </section>
    </main>
  );
}

function Field({ label, icon, error, invalid, children }: {
  label: string;
  icon: ReactNode;
  error?: string | null;
  invalid?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="login-field">
      <span className="login-field__label">{label}</span>
      <span className={`login-input${invalid ? ' login-input--invalid' : ''}`}>
        <span className="login-input__icon">{icon}</span>
        {children}
      </span>
      {error && <small id="login-email-error" className="login-field__error">{error}</small>}
    </label>
  );
}

const svgProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

function MailIcon() {
  return <svg {...svgProps}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></svg>;
}

function LockIcon() {
  return <svg {...svgProps}><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></svg>;
}

function EyeIcon() {
  return <svg {...svgProps}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></svg>;
}

function EyeOffIcon() {
  return <svg {...svgProps}><path d="M10.6 5.6A9.8 9.8 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.6 3.4M6.3 6.9C3.9 8.6 2.5 12 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4.2-1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" /></svg>;
}

function AlertIcon() {
  return <svg {...svgProps}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5h.01" /></svg>;
}

function CheckIcon() {
  return <svg {...svgProps} width={14} height={14} strokeWidth={2.4}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
}

function ShieldIcon() {
  return <svg {...svgProps} width={16} height={16}><path d="M12 3 5 6v5.5c0 4.3 3 8 7 9.5 4-1.5 7-5.2 7-9.5V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg>;
}
