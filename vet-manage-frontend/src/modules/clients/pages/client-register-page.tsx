import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CheckIcon, HomeIcon, IdCardIcon, InfoIcon, MailIcon, PawIcon, PhoneIcon, ShieldIcon, UserIcon,
} from '../../../common/components/icons';
import { useToast } from '../../../common/components/toast-context';
import { buildClientInput, describeApiError, MISSING_FIELDS, registrationOutcome, validateRegistration } from '../form-rules';
import type { FieldErrors, Form } from '../form-rules';
import { clientsApi } from '../services/clients-api';
import { CLIENT_ROLE } from '../types';
import type { AssignableRole } from '../types';
import './client-register-page.css';

const FALLBACK_ROLE: AssignableRole = {
  name: CLIENT_ROLE,
  displayName: 'Cliente',
  description: 'Dueño del paciente; se asigna automáticamente al registrar.',
};

const emptyForm: Form = { identification: '', firstName: '', lastName: '', email: '', phone: '', address: '' };

export function ClientRegisterPage() {
  const [form, setForm] = useState<Form>(emptyForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [role, setRole] = useState<AssignableRole>(FALLBACK_ROLE);
  const [rolesState, setRolesState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    clientsApi.assignableRoles()
      .then((loaded) => {
        if (!active) return;
        setRole(loaded.find((item) => item.name === CLIENT_ROLE) ?? FALLBACK_ROLE);
        setRolesState('ready');
      })
      .catch(() => { if (active) setRolesState('error'); });
    return () => { active = false; };
  }, []);

  function update(field: keyof Form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;

    const { errors: found, missing } = validateRegistration(form);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      showToast(missing ? MISSING_FIELDS : 'Revise los datos ingresados.', 'error');
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      const client = await clientsApi.register(buildClientInput(form));
      const outcome = registrationOutcome(client);
      showToast(outcome.message, outcome.type);
      navigate('/clients');
    } catch (cause) {
      const failure = describeApiError(cause);
      setErrors(failure.errors);
      showToast(failure.message, 'error');
      setSaving(false);
    }
  }

  return (
    <section className="clients-page">
      <Link className="back-link" to="/clients">← Volver a clientes</Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Administración · Clientes</span>
          <h2>Registrar cliente</h2>
          <p>Registre los datos de contacto del cliente; las credenciales se envían al correo registrado.</p>
        </div>
      </div>

      <form className="register-form" onSubmit={submit} noValidate>
        <div className="register-form__grid">
          <div className="register-card">
            <header className="register-card__header">
              <span className="register-card__icon"><UserIcon size={18} /></span>
              <div><h3>Datos del cliente</h3><p>La cédula identifica a la persona en todo el sistema.</p></div>
            </header>

            <div className="register-card__fields">
              <Field label="Cédula" required error={errors.identification} icon={<IdCardIcon size={16} />}>
                <input value={form.identification} inputMode="numeric" maxLength={10} placeholder="10 dígitos" autoComplete="off"
                  aria-invalid={Boolean(errors.identification)} onChange={(event) => update('identification', event.target.value.replace(/\D/g, ''))} />
              </Field>
              <Field label="Teléfono" hint="Opcional" error={errors.phone} icon={<PhoneIcon size={16} />}>
                <input type="tel" value={form.phone} maxLength={16} placeholder="0991234567" autoComplete="off"
                  aria-invalid={Boolean(errors.phone)} onChange={(event) => update('phone', event.target.value)} />
              </Field>
              <Field label="Nombres" required error={errors.firstName} icon={<UserIcon size={16} />}>
                <input value={form.firstName} maxLength={100} placeholder="Nombres completos" aria-invalid={Boolean(errors.firstName)}
                  onChange={(event) => update('firstName', event.target.value)} />
              </Field>
              <Field label="Apellidos" required error={errors.lastName} icon={<UserIcon size={16} />}>
                <input value={form.lastName} maxLength={100} placeholder="Apellidos completos" aria-invalid={Boolean(errors.lastName)}
                  onChange={(event) => update('lastName', event.target.value)} />
              </Field>
              <Field className="register-card__full" label="Correo electrónico" required error={errors.email} icon={<MailIcon size={16} />}>
                <input type="email" value={form.email} maxLength={255} placeholder="cliente@correo.com" autoComplete="off"
                  aria-invalid={Boolean(errors.email)} onChange={(event) => update('email', event.target.value)} />
              </Field>
              <Field className="register-card__full" label="Dirección" hint="Opcional" error={errors.address} icon={<HomeIcon size={16} />}>
                <input value={form.address} maxLength={255} placeholder="Dirección del cliente" autoComplete="off"
                  aria-invalid={Boolean(errors.address)} onChange={(event) => update('address', event.target.value)} />
              </Field>
            </div>

            <div className="register-card__note">
              <InfoIcon size={18} />
              <p><strong>Acceso al sistema.</strong> Al guardar se genera una contraseña temporal y se envía a este correo. El cliente deberá cambiarla en su primer ingreso.</p>
            </div>
          </div>

          <div className="register-card">
            <header className="register-card__header">
              <span className="register-card__icon"><ShieldIcon size={18} /></span>
              <div><h3>Roles</h3><p>El cliente recibe únicamente el rol de cliente.</p></div>
              <span className="register-card__count register-card__count--active">1 seleccionado</span>
            </header>

            <fieldset className="role-list">
              <legend className="sr-only">Rol del cliente</legend>
              <div className="role-card role-card--selected role-card--fixed">
                <input className="sr-only" type="checkbox" checked readOnly disabled aria-label={`Rol ${role.displayName}`} />
                <span className="role-card__icon"><PawIcon size={18} /></span>
                <span className="role-card__text"><b>{role.displayName}</b>{role.description && <small>{role.description}</small>}</span>
                <span className="role-card__check" aria-hidden="true"><CheckIcon size={13} /></span>
              </div>
            </fieldset>
            <p className="register-card__hint">
              {rolesState === 'error'
                ? 'No se pudo cargar el detalle del rol; se aplicará la configuración por defecto.'
                : 'Este rol se asigna automáticamente y no se puede modificar.'}
            </p>
          </div>
        </div>

        <div className="register-form__actions">
          <Link className="button button--ghost" to="/clients">Cancelar</Link>
          <button className="button button--primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cliente'}</button>
        </div>
      </form>
    </section>
  );
}

function Field({ label, required, hint, error, icon, className = '', children }: {
  label: string; required?: boolean; hint?: string; error?: string; icon: ReactNode; className?: string; children: ReactNode;
}) {
  return (
    <label className={`field ${className}`}>
      <span>{label}{required && <b> *</b>}</span>
      <span className="input-icon">{icon}{children}</span>
      {hint && !error && <small>{hint}</small>}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}
