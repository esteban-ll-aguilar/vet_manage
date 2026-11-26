import { useEffect, useState, type FormEvent } from 'react';
import { HomeIcon, IdCardIcon, InfoIcon, MailIcon, PhoneIcon, UserIcon } from '../../../common/components/icons';
import { ClientField as Field } from './client-field';
import {
  buildClientUpdateInput, describeApiError, EMAIL_LOCKED_HINT, isEmailLocked, MISSING_FIELDS, sanitizePhone,
  toEditForm, validateClientUpdate,
} from '../form-rules';
import type { EditForm, FieldErrors } from '../form-rules';
import type { ClientListItem, UpdateClientInput } from '../types';
import '../pages/client-register-page.css';
import './client-edit-modal.css';

type ClientEditModalProps = {
  client: ClientListItem;
  onSubmit: (input: UpdateClientInput) => Promise<void>;
  onCancel: () => void;
};

// Edición de los datos de contacto del cliente (HU-02). La cédula se muestra, pero no se puede cambiar.
export function ClientEditModal({ client, onSubmit, onCancel }: ClientEditModalProps) {
  const [form, setForm] = useState<EditForm>(() => toEditForm(client));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const emailLocked = isEmailLocked(client);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [saving, onCancel]);

  function update(field: keyof EditForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateClientUpdate(form);
    const invalid = Object.values(validation.errors).filter(Boolean);
    if (invalid.length > 0) {
      setErrors(validation.errors);
      setMessage(validation.missing ? MISSING_FIELDS : invalid[0] ?? null);
      return;
    }

    setErrors({});
    setMessage(null);
    setSaving(true);
    try {
      await onSubmit(buildClientUpdateInput(form));
    } catch (cause) {
      const failure = describeApiError(cause);
      setErrors(failure.errors);
      setMessage(failure.message);
      setSaving(false);
    }
  }

  return (
    <div
      className="clients-modal-backdrop"
      onClick={() => {
        if (!saving) onCancel();
      }}
    >
      <div
        className="clients-modal client-edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-edit-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="clients-modal__header">
          <div className="clients-modal__icon client-edit-modal__icon"><UserIcon size={20} /></div>
          <div className="clients-modal__title-wrap">
            <span className="clients-modal__eyebrow">Gestión de clientes</span>
            <h3 id="client-edit-dialog-title">Editar cliente</h3>
          </div>
          <button className="clients-modal__close" type="button" aria-label="Cerrar" disabled={saving} onClick={onCancel}>
            ×
          </button>
        </div>

        <form onSubmit={submit} noValidate>
          <div className="clients-modal__body">
            <div className="register-card__fields">
              <Field label="Cédula" hint="La cédula identifica al cliente y no se puede modificar" icon={<IdCardIcon size={16} />}>
                <input value={client.identification} disabled readOnly />
              </Field>
              <Field label="Teléfono" required error={errors.phone} icon={<PhoneIcon size={16} />}>
                <input type="tel" inputMode="numeric" value={form.phone} placeholder="0991234567" autoComplete="off"
                  disabled={saving} aria-invalid={Boolean(errors.phone)} onChange={(event) => update('phone', sanitizePhone(event.target.value))} />
              </Field>
              <Field label="Nombres" required error={errors.firstName} icon={<UserIcon size={16} />}>
                <input value={form.firstName} maxLength={100} disabled={saving} aria-invalid={Boolean(errors.firstName)}
                  onChange={(event) => update('firstName', event.target.value)} />
              </Field>
              <Field label="Apellidos" required error={errors.lastName} icon={<UserIcon size={16} />}>
                <input value={form.lastName} maxLength={100} disabled={saving} aria-invalid={Boolean(errors.lastName)}
                  onChange={(event) => update('lastName', event.target.value)} />
              </Field>
              <Field className="register-card__full" label="Correo electrónico" required error={errors.email}
                hint={emailLocked ? EMAIL_LOCKED_HINT : undefined} icon={<MailIcon size={16} />}>
                <input type="email" value={form.email} maxLength={255} autoComplete="off" disabled={saving || emailLocked}
                  readOnly={emailLocked} aria-invalid={Boolean(errors.email)} onChange={(event) => update('email', event.target.value)} />
              </Field>
              <Field className="register-card__full" label="Dirección" hint="Opcional" error={errors.address} icon={<HomeIcon size={16} />}>
                <input value={form.address} maxLength={255} autoComplete="off" disabled={saving} aria-invalid={Boolean(errors.address)}
                  onChange={(event) => update('address', event.target.value)} />
              </Field>
            </div>

            {!emailLocked && (
              <p className="client-edit-modal__note">
                <InfoIcon size={16} />
                <span>El correo también es el que el cliente usa para iniciar sesión.</span>
              </p>
            )}

            {message && <div className="inline-notice inline-notice--error" role="alert">{message}</div>}
          </div>

          <div className="clients-modal__actions">
            <button className="button button--ghost" type="button" disabled={saving} onClick={onCancel}>Cancelar</button>
            <button className="button button--primary" type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
