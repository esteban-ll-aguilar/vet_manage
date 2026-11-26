import { ApiError } from '../../infrastructure/api/http-client';
import { isValidIdentification } from '../../common/validation/identification';
import type { RegisteredUser, UpdateUserInput, UserDetail } from './types';

export const MISSING_FIELDS = 'Complete los campos obligatorios';
export const INVALID_IDENTIFICATION = 'La cédula debe tener 10 dígitos válidos';
export const INVALID_EMAIL = 'Ingrese un correo electrónico válido';
export const INVALID_PHONE = 'Ingrese un teléfono válido';
export const MAIL_FAILED = 'Usuario registrado, pero no se pudo enviar el correo. Verifique la dirección y reenvíe las credenciales';
const REGISTERED = 'Usuario registrado correctamente';
// Mensajes de los criterios de aceptación de HU-53.
export const INVALID_FORMAT = 'Formato no válido';
export const UPDATED = 'Datos actualizados correctamente';
export const NOTICE_FAILED = 'No se pudo enviar el aviso al correo anterior';
const NAME_MAX = 100;
// Límites de los campos del formulario: los mismos que acepta la API.
export const USER_FIELD_LIMITS = { name: NAME_MAX, email: 255, phone: 16 } as const;

// Deja solo dígitos y un "+" inicial opcional en el teléfono, hasta 16 caracteres (+ y 15 dígitos).
export function sanitizePhone(value: string): string {
  const plus = value.trimStart().startsWith('+') ? '+' : '';
  return `${plus}${value.replace(/\D/g, '')}`.slice(0, USER_FIELD_LIMITS.phone);
}
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^\+?\d{7,15}$/;

export type FieldName = 'identification' | 'firstName' | 'lastName' | 'email' | 'phone' | 'roles';
export type FieldErrors = Partial<Record<FieldName, string>>;
export type Form = { identification: string; firstName: string; lastName: string; email: string; phone: string; roles: string[] };

// Errores por campo antes de llamar a la API; vacío significa que el formulario puede enviarse.
export function validateRegistration(form: Form): { errors: FieldErrors; missing: boolean } {
  const errors: FieldErrors = {};
  let missing = false;
  const required: [FieldName, string][] = [
    ['identification', form.identification.trim()],
    ['firstName', form.firstName.trim()],
    ['lastName', form.lastName.trim()],
    ['email', form.email.trim()],
    ['roles', form.roles.length > 0 ? 'x' : ''],
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
  return { errors, missing };
}

export type EditForm = { firstName: string; lastName: string; email: string; phone: string };

// Formulario de edición (HU-53): nombre, apellido y correo obligatorios; teléfono opcional con el formato del registro.
export function validateUserUpdate(form: EditForm): { errors: FieldErrors; missing: boolean } {
  const errors: FieldErrors = {};
  let missing = false;
  for (const field of ['firstName', 'lastName', 'email'] as const) {
    if (!form[field].trim()) {
      errors[field] = MISSING_FIELDS;
      missing = true;
    }
  }
  for (const field of ['firstName', 'lastName'] as const) {
    if (!errors[field] && form[field].trim().length > NAME_MAX) errors[field] = INVALID_FORMAT;
  }
  if (!errors.email && !EMAIL_PATTERN.test(form.email.trim())) errors.email = INVALID_FORMAT;
  if (form.phone.trim() && !PHONE_PATTERN.test(form.phone.trim())) errors.phone = INVALID_FORMAT;
  return { errors, missing };
}

export function buildUserUpdateInput(form: EditForm): UpdateUserInput {
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
  };
}

export function toEditForm(user: Pick<UserDetail, 'firstName' | 'lastName' | 'email' | 'phone'>): EditForm {
  return { firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone ?? '' };
}

// Traduce el rechazo de la API a un aviso y a los campos que se resaltan.
export function describeApiError(cause: unknown): { message: string; errors: FieldErrors } {
  if (!(cause instanceof ApiError)) {
    return { message: 'No se pudo conectar con el servidor. Intente nuevamente.', errors: {} };
  }
  const errors: FieldErrors = {};
  if (cause.code === 'USER_IDENTIFICATION_TAKEN') errors.identification = cause.message;
  else if (cause.code === 'USER_EMAIL_TAKEN') errors.email = cause.message;
  else if (cause.code === 'USER_INVALID_ROLES') errors.roles = cause.message;
  else {
    const fields: FieldName[] = ['identification', 'firstName', 'lastName', 'email', 'phone', 'roles'];
    for (const field of cause.errors) {
      if ((fields as string[]).includes(field)) errors[field as FieldName] = cause.message;
    }
  }
  return { message: cause.message, errors };
}

// Aviso que se muestra tras registrar: advertencia si faltó enviar las credenciales; éxito en los demás casos.
export function registrationOutcome(user: Pick<RegisteredUser, 'existingPerson' | 'passwordAssigned' | 'credentialsSent'>): { type: 'success' | 'warning'; message: string } {
  if (user.passwordAssigned && !user.credentialsSent) return { type: 'warning', message: MAIL_FAILED };
  const reused = user.existingPerson ? ' La persona ya existía: se agregaron los roles a su cuenta.' : '';
  return { type: 'success', message: `${REGISTERED}.${reused}` };
}
