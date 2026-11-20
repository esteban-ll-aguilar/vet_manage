import { isValidIdentification } from '../../common/validation/identification';
import { ApiError } from '../../infrastructure/api/http-client';
import { CLIENT_ROLE } from './types';
import type { RegisteredClient, RegisterClientInput } from './types';

export const MISSING_FIELDS = 'Complete los campos obligatorios';
export const INVALID_IDENTIFICATION = 'La cédula debe tener 10 dígitos válidos';
export const INVALID_EMAIL = 'Ingrese un correo electrónico válido';
export const INVALID_PHONE = 'Ingrese un teléfono válido';
export const INVALID_ADDRESS = 'Dirección no válida';
export const MAIL_FAILED = 'Cliente registrado, pero no se pudo enviar el correo. Verifique la dirección y reenvíe las credenciales';
const REGISTERED = 'Cliente registrado correctamente';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^\+?\d{7,15}$/;
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
  ];
  for (const [field, value] of required) {
    if (!value) {
      errors[field] = MISSING_FIELDS;
      missing = true;
    }
  }
  if (!errors.identification && !isValidIdentification(form.identification.trim())) errors.identification = INVALID_IDENTIFICATION;
  if (!errors.email && !EMAIL_PATTERN.test(form.email.trim())) errors.email = INVALID_EMAIL;
  if (form.phone.trim() && !PHONE_PATTERN.test(form.phone.trim())) errors.phone = INVALID_PHONE;
  if (form.address.trim().length > ADDRESS_MAX) errors.address = INVALID_ADDRESS;
  return { errors, missing };
}

// El rol de cliente es fijo: se envía siempre, independientemente de la UI.
export function buildClientInput(form: Form): RegisterClientInput {
  return {
    identification: form.identification.trim(),
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim(),
    phone: form.phone.trim() || undefined,
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
  else if (cause.code === 'CLIENT_EMAIL_TAKEN' || cause.code === 'CLIENT_INVALID_EMAIL') errors.email = cause.message;
  else if (cause.code === 'CLIENT_INVALID_PHONE') errors.phone = cause.message;
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
  return { message: cause.message, errors };
}

// Aviso que se muestra tras registrar: advertencia si faltó enviar las credenciales; éxito en los demás casos.
export function registrationOutcome(client: Pick<RegisteredClient, 'existingPerson' | 'passwordAssigned' | 'credentialsSent'>): { type: 'success' | 'warning'; message: string } {
  if (client.passwordAssigned && !client.credentialsSent) return { type: 'warning', message: MAIL_FAILED };
  const reused = client.existingPerson ? ' La persona ya existía: se agregaron los roles a su cuenta.' : '';
  return { type: 'success', message: `${REGISTERED}.${reused}` };
}
