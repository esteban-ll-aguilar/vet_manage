import { isValidIdentification } from '../../common/validation/identification';
import { ApiError } from '../../infrastructure/api/http-client';
import { CLIENT_ROLE } from './types';
import type { ClientListItem, RegisteredClient, RegisterClientInput, UpdateClientInput } from './types';

export const MISSING_FIELDS = 'Por favor, complete todos los campos obligatorios';
export const INVALID_IDENTIFICATION = 'Número de cédula no válido';
export const INVALID_EMAIL = 'Por favor, ingrese un correo y número de teléfono válido';
export const INVALID_PHONE = 'Por favor, ingrese un correo y número de teléfono válido';
export const INVALID_ADDRESS = 'Dirección no válida';
export const UPDATED = 'Datos actualizados correctamente';
export const EMAIL_LOCKED_HINT = 'Este cliente también es parte del personal: solo el Administrador puede cambiar su correo';
export const MAIL_FAILED = 'Cliente registrado, pero no se pudo enviar el correo. Verifique la dirección y reenvíe las credenciales';
const REGISTERED = 'Cliente registrado exitosamente';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^09\d{8}$/;

// En la edición (HU-02) el teléfono solo admite números. No se recorta la longitud: con 9 u 11 dígitos
// la validación muestra el mensaje, como en el registro (HU-01), en lugar de guardar un número recortado.
export function sanitizePhone(value: string): string {
  return value.replace(/\D/g, '');
}
const ADDRESS_MAX = 255;

export type FieldName = 'identification' | 'firstName' | 'lastName' | 'email' | 'phone' | 'address' | 'roles';
export type FieldErrors = Partial<Record<FieldName, string>>;
export type Form = { identification: string; firstName: string; lastName: string; email: string; phone: string; address: string };

// Errores por campo antes de llamar a la API; vacío significa que el formulario puede enviarse.
export function validateRegistration(form: Form): { errors: FieldErrors; missing: boolean } {
  const errors: FieldErrors = {};
  let missing = false;
  const required: [FieldName, string][] = [
    ['identification', form.identification.trim()],
    ['firstName', form.firstName.trim()],
    ['lastName', form.lastName.trim()],
    ['email', form.email.trim()],
    ['phone', form.phone.trim()],
  ];
  for (const [field, value] of required) {
    if (!value) {
      errors[field] = MISSING_FIELDS;
      missing = true;
    }
  }
  if (!errors.identification && !isValidIdentification(form.identification.trim())) errors.identification = INVALID_IDENTIFICATION;
  if (!errors.email && !EMAIL_PATTERN.test(form.email.trim())) errors.email = INVALID_EMAIL;
  if (!errors.phone && !PHONE_PATTERN.test(form.phone.trim())) errors.phone = INVALID_PHONE;
  if (form.address.trim().length > ADDRESS_MAX) errors.address = INVALID_ADDRESS;
  return { errors, missing };
}

export type EditForm = Omit<Form, 'identification'>;

// Formulario de edición (HU-02): mismas reglas que el registro, sin la cédula, que no se puede cambiar.
export function validateClientUpdate(form: EditForm): { errors: FieldErrors; missing: boolean } {
  const { errors, missing } = validateRegistration({ ...form, identification: '-' });
  delete errors.identification;
  return { errors, missing };
}

export function buildClientUpdateInput(form: EditForm): UpdateClientInput {
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    address: form.address.trim(),
  };
}

export function toEditForm(client: Pick<ClientListItem, 'firstName' | 'lastName' | 'email' | 'phone' | 'address'>): EditForm {
  return {
    firstName: client.firstName,
    lastName: client.lastName,
    email: client.email,
    phone: client.phone ?? '',
    address: client.address ?? '',
  };
}

// El correo es el de inicio de sesión: si la persona tiene un rol del personal, solo lo cambia el Administrador.
export function isEmailLocked(client: Pick<ClientListItem, 'roles'>): boolean {
  return client.roles.some((role) => role.name !== CLIENT_ROLE);
}

// El rol de cliente es fijo: se envía siempre, independientemente de la UI.
export function buildClientInput(form: Form): RegisterClientInput {
  return {
    identification: form.identification.trim(),
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    address: form.address.trim() || undefined,
    roles: [CLIENT_ROLE],
  };
}

// Traduce el rechazo de la API a un aviso y a los campos que se resaltan.
export function describeApiError(cause: unknown): { message: string; errors: FieldErrors } {
  if (!(cause instanceof ApiError)) {
    return { message: 'No se pudo conectar con el servidor. Intente nuevamente.', errors: {} };
  }
  const errors: FieldErrors = {};
  if (cause.code === 'CLIENT_IDENTIFICATION_TAKEN' || cause.code === 'CLIENT_INVALID_IDENTIFICATION') errors.identification = cause.message;
  else if (cause.code === 'CLIENT_EMAIL_TAKEN') errors.email = cause.message;
  else if (cause.code === 'CLIENT_INVALID_EMAIL') errors.email = INVALID_EMAIL;
  else if (cause.code === 'CLIENT_INVALID_PHONE') errors.phone = INVALID_PHONE;
  else if (cause.code === 'CLIENT_INVALID_ADDRESS') errors.address = cause.message;
  else if (cause.code === 'CLIENT_INVALID_NAME') {
    errors.firstName = cause.message;
    errors.lastName = cause.message;
  } else {
    const fields: FieldName[] = ['identification', 'firstName', 'lastName', 'email', 'phone', 'address', 'roles'];
    for (const field of cause.errors) {
      if ((fields as string[]).includes(field)) errors[field as FieldName] = cause.message;
    }
  }
  const message = cause.code === 'CLIENT_INVALID_EMAIL' || cause.code === 'CLIENT_INVALID_PHONE' ? INVALID_EMAIL : cause.message;
  return { message, errors };
}

// Aviso que se muestra tras registrar: advertencia si faltó enviar las credenciales; éxito en los demás casos.
export function registrationOutcome(client: Pick<RegisteredClient, 'existingPerson' | 'passwordAssigned' | 'credentialsSent'>): { type: 'success' | 'warning'; message: string } {
  if (client.passwordAssigned && !client.credentialsSent) return { type: 'warning', message: MAIL_FAILED };
  return { type: 'success', message: REGISTERED };
}
