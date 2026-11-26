import { isEmail } from 'class-validator';
import { ApiException } from '../../../common/errors/api-exception.js';

// Mensajes de los criterios de aceptación de HU-53.
export const USER_CONTACT_MESSAGES = {
  missing: 'Complete los campos obligatorios',
  invalidFormat: 'Formato no válido',
} as const;

// Mismo formato de teléfono que el registro de usuarios (HU-51).
const PHONE_PATTERN = /^\+?\d{7,15}$/;
const NAME_MAX = 100;
const EMAIL_MAX = 255;

export type UserContactInput = {
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  phone?: unknown;
};

export type UserContact = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
};

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

// Normaliza (sin espacios, correo en minúsculas, teléfono vacío como null) y valida; lanza ApiException con los campos rechazados.
export function validateUserContact(input: UserContactInput): UserContact {
  const firstName = text(input.firstName);
  const lastName = text(input.lastName);
  const email = text(input.email).toLowerCase();
  const phone = text(input.phone) || null;

  const missing = [!firstName && 'firstName', !lastName && 'lastName', !email && 'email']
    .filter((field): field is string => Boolean(field));
  if (missing.length > 0) {
    throw new ApiException(USER_CONTACT_MESSAGES.missing, 400, missing, 'USER_MISSING_FIELDS');
  }

  if (email.length > EMAIL_MAX || !isEmail(email)) {
    throw new ApiException(USER_CONTACT_MESSAGES.invalidFormat, 400, ['email'], 'USER_INVALID_EMAIL');
  }
  if (phone && !PHONE_PATTERN.test(phone)) {
    throw new ApiException(USER_CONTACT_MESSAGES.invalidFormat, 400, ['phone'], 'USER_INVALID_PHONE');
  }
  const longNames = [firstName.length > NAME_MAX && 'firstName', lastName.length > NAME_MAX && 'lastName']
    .filter((field): field is string => Boolean(field));
  if (longNames.length > 0) {
    throw new ApiException(USER_CONTACT_MESSAGES.invalidFormat, 400, longNames, 'USER_INVALID_NAME');
  }

  return { firstName, lastName, email, phone };
}
