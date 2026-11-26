import { isEmail } from 'class-validator';
import { ApiException } from '../../../common/errors/api-exception.js';
import { CLIENT_CONTACT_LIMITS, CLIENT_MESSAGES } from '../../identity/services/client-registration.service.js';

// Mismas reglas, mensajes y límites que el registro de clientes (HU-01); las usa la actualización (HU-02).
const { phonePattern: PHONE_PATTERN, nameMax: NAME_MAX, emailMax: EMAIL_MAX, addressMax: ADDRESS_MAX } = CLIENT_CONTACT_LIMITS;

export type ClientContactInput = {
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  phone?: unknown;
  address?: unknown;
};

export type ClientContact = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string | null;
};

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

// Normaliza (sin espacios, correo en minúsculas) y valida; lanza ApiException con los campos rechazados.
export function validateClientContact(input: ClientContactInput): ClientContact {
  const firstName = text(input.firstName);
  const lastName = text(input.lastName);
  const email = text(input.email).toLowerCase();
  const phone = text(input.phone);
  const address = text(input.address) || null;

  const missing = [
    !firstName && 'firstName',
    !lastName && 'lastName',
    !email && 'email',
    !phone && 'phone',
  ].filter((field): field is string => Boolean(field));
  if (missing.length > 0) throw new ApiException(CLIENT_MESSAGES.missing, 400, missing, 'CLIENT_MISSING_FIELDS');

  if (email.length > EMAIL_MAX || !isEmail(email)) {
    throw new ApiException(CLIENT_MESSAGES.invalidEmail, 400, ['email'], 'CLIENT_INVALID_EMAIL');
  }
  if (!PHONE_PATTERN.test(phone)) {
    throw new ApiException(CLIENT_MESSAGES.invalidPhone, 400, ['phone'], 'CLIENT_INVALID_PHONE');
  }
  if (address && address.length > ADDRESS_MAX) {
    throw new ApiException(CLIENT_MESSAGES.invalidAddress, 400, ['address'], 'CLIENT_INVALID_ADDRESS');
  }
  const longNames = [firstName.length > NAME_MAX && 'firstName', lastName.length > NAME_MAX && 'lastName']
    .filter((field): field is string => Boolean(field));
  if (longNames.length > 0) {
    throw new ApiException(CLIENT_MESSAGES.invalidName, 400, longNames, 'CLIENT_INVALID_NAME');
  }

  return { firstName, lastName, email, phone, address };
}
