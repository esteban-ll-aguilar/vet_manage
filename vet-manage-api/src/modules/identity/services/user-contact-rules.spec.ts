import { describe, expect, it } from 'vitest';
import { ApiException } from '../../../common/errors/api-exception.js';
import { USER_CONTACT_MESSAGES, validateUserContact, type UserContactInput } from './user-contact-rules.js';

const valid = (overrides: UserContactInput = {}): UserContactInput => ({
  firstName: '  Carlos ',
  lastName: 'Pérez',
  email: '  Carlos.Perez@Correo.com ',
  phone: ' 0992222222 ',
  ...overrides,
});

function rejection(input: UserContactInput): ApiException {
  try {
    validateUserContact(input);
  } catch (error) {
    if (error instanceof ApiException) return error;
    throw error;
  }
  throw new Error('Se esperaba un rechazo');
}

describe('validateUserContact', () => {
  it('normaliza espacios y pasa el correo a minúsculas', () => {
    expect(validateUserContact(valid())).toEqual({
      firstName: 'Carlos',
      lastName: 'Pérez',
      email: 'carlos.perez@correo.com',
      phone: '0992222222',
    });
  });

  it.each([[''], ['   '], [undefined], [null]])('deja el teléfono en null cuando llega %j', (phone) => {
    expect(validateUserContact(valid({ phone })).phone).toBeNull();
  });

  it('acepta el teléfono con prefijo internacional', () => {
    expect(validateUserContact(valid({ phone: '+593992222222' })).phone).toBe('+593992222222');
  });

  it('lista los obligatorios vacíos con el mensaje de la HU', () => {
    const error = rejection({ firstName: ' ', lastName: '', email: undefined });

    expect(error.message).toBe('Complete los campos obligatorios');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('USER_MISSING_FIELDS');
    expect(error.errors).toEqual(['firstName', 'lastName', 'email']);
  });

  it('trata como vacío un valor que no es texto', () => {
    expect(rejection(valid({ firstName: 123 })).errors).toEqual(['firstName']);
  });

  it.each([['carlos@'], ['carlos'], [`${'a'.repeat(250)}@correo.com`]])('rechaza el correo %s con "Formato no válido"', (email) => {
    const error = rejection(valid({ email }));

    expect(error.message).toBe(USER_CONTACT_MESSAGES.invalidFormat);
    expect(error.code).toBe('USER_INVALID_EMAIL');
    expect(error.errors).toEqual(['email']);
  });

  it.each([['0991'], ['09922a2222'], ['1234567890123456']])('rechaza el teléfono %s con "Formato no válido"', (phone) => {
    const error = rejection(valid({ phone }));

    expect(error.message).toBe('Formato no válido');
    expect(error.code).toBe('USER_INVALID_PHONE');
    expect(error.errors).toEqual(['phone']);
  });

  it('rechaza solo el nombre que supera 100 caracteres con "Formato no válido"', () => {
    const error = rejection(valid({ firstName: 'C'.repeat(101) }));

    expect(error.message).toBe('Formato no válido');
    expect(error.code).toBe('USER_INVALID_NAME');
    expect(error.errors).toEqual(['firstName']);
  });
});
