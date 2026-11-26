import { useEffect, useState, type FormEvent } from 'react';
import { IdCardIcon, InfoIcon, MailIcon, PhoneIcon, UserIcon } from '../../../common/components/icons';
import {
  buildUserUpdateInput, describeApiError, MISSING_FIELDS, sanitizePhone, toEditForm, USER_FIELD_LIMITS, validateUserUpdate,
} from '../form-rules';
import type { EditForm, FieldErrors } from '../form-rules';
import type { UpdateUserInput, UserDetail } from '../types';
import { UserField as Field } from './user-field';
import '../pages/user-register-page.css';
import './user-edit-modal.css';

type UserEditModalProps = {
  user: UserDetail;
  // Ficha de consulta: los usuarios dados de baja se muestran sin poder editarse (HU-53, escenario 8).
  readOnly?: boolean;
  onSubmit?: (input: UpdateUserInput) => Promise<void>;
  onClose: () => void;
};

function formatDeactivatedDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-EC');
}

// Edición de los datos de contacto del usuario (HU-53). La cédula se muestra, pero no se puede cambiar.
export function UserEditModal({ user, readOnly = false, onSubmit, onClose }: UserEditModalProps) {
  const [form, setForm] = useState<EditForm>(() => toEditForm(user));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const locked = readOnly || saving;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [saving, onClose]);

  function update(field: keyof EditForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly || !onSubmit) return;
    const validation = validateUserUpdate(form);
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
      await onSubmit(buildUserUpdateInput(form));
    } catch (cause) {
      const failure = describeApiError(cause);
      setErrors(failure.errors);
      setMessage(failure.message);
      setSaving(false);
    }
  }

  const title = readOnly ? 'Datos del usuario' : 'Editar usuario';

  return (
    <div
      className="users-modal-backdrop"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div
        className="users-modal user-edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-edit-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="users-modal__header">
          <div className="users-modal__icon user-edit-modal__icon"><UserIcon size={20} /></div>
          <div className="users-modal__title-wrap">
            <span className="users-modal__eyebrow">Gestión de usuarios</span>
            <h3 id="user-edit-dialog-title">{title}</h3>
          </div>
          <button className="users-modal__close" type="button" aria-label="Cerrar" disabled={saving} onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={submit} noValidate>
          <div className="users-modal__body">
            {readOnly && (
              <p className="user-edit-modal__note user-edit-modal__note--warning" role="note">
                <InfoIcon size={16} />
                <span>Este usuario fue dado de baja: sus datos se muestran solo para consulta.</span>
              </p>
            )}

            <div className="register-card__fields">
              <Field label="Cédula" hint={readOnly ? undefined : 'La cédula no se puede modificar'} icon={<IdCardIcon size={16} />}>
                <input value={user.identification} disabled readOnly />
              </Field>
              <Field label="Teléfono" hint={readOnly ? undefined : 'Opcional'} error={errors.phone} icon={<PhoneIcon size={16} />}>
                <input type="tel" inputMode="tel" value={form.phone} maxLength={USER_FIELD_LIMITS.phone} placeholder={readOnly ? '' : '0991234567'}
                  autoComplete="off" disabled={locked} aria-invalid={Boolean(errors.phone)}
                  onChange={(event) => update('phone', sanitizePhone(event.target.value))} />
              </Field>
              <Field label="Nombres" required={!readOnly} error={errors.firstName} icon={<UserIcon size={16} />}>
                <input value={form.firstName} maxLength={USER_FIELD_LIMITS.name} disabled={locked} aria-invalid={Boolean(errors.firstName)}
                  onChange={(event) => update('firstName', event.target.value)} />
              </Field>
              <Field label="Apellidos" required={!readOnly} error={errors.lastName} icon={<UserIcon size={16} />}>
                <input value={form.lastName} maxLength={USER_FIELD_LIMITS.name} disabled={locked} aria-invalid={Boolean(errors.lastName)}
                  onChange={(event) => update('lastName', event.target.value)} />
              </Field>
              <Field className="register-card__full" label="Correo electrónico" required={!readOnly} error={errors.email} icon={<MailIcon size={16} />}>
                <input type="email" value={form.email} maxLength={USER_FIELD_LIMITS.email} autoComplete="off" disabled={locked}
                  aria-invalid={Boolean(errors.email)} onChange={(event) => update('email', event.target.value)} />
              </Field>
              {readOnly && (user.deactivatedAt || user.deactivationReason) && (
                <>
                  {user.deactivatedAt && (
                    <Field label="Fecha de baja" icon={<InfoIcon size={16} />}>
                      <input value={formatDeactivatedDate(user.deactivatedAt)} disabled readOnly />
                    </Field>
                  )}
                  {user.deactivationReason && (
                    <Field className="register-card__full" label="Motivo de la baja" icon={<InfoIcon size={16} />}>
                      <input value={user.deactivationReason} disabled readOnly />
                    </Field>
                  )}
                </>
              )}
            </div>

            {!readOnly && (
              <p className="user-edit-modal__note">
                <InfoIcon size={16} />
                <span>El correo es el de inicio de sesión. Si lo cambia, se enviará un aviso al correo anterior.</span>
              </p>
            )}

            {message && <div className="inline-notice inline-notice--error" role="alert">{message}</div>}
          </div>

          <div className="users-modal__actions">
            {readOnly ? (
              <button className="button button--ghost" type="button" onClick={onClose}>Cerrar</button>
            ) : (
              <>
                <button className="button button--ghost" type="button" disabled={saving} onClick={onClose}>Cancelar</button>
                <button className="button button--primary" type="submit" disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
