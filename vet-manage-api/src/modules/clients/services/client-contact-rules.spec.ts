import { describe, expect, it } from 'vitest';
import { ApiException } from '../../../common/errors/api-exception.js';
import { CLIENT_MESSAGES } from '../../identity/services/client-registration.service.js';
import { validateClientContact, type ClientContactInput } from './client-contact-rules.js';

const valid = (overrides: ClientContactInput = {}): ClientContactInput => ({
  firstName: '  Carlos ',
  lastName: 'Pérez',
  email: '  Carlos.Perez@Correo.com ',
  phone: '0992222222',
  address: ' Av. Amazonas 123 ',
  ...overrides,
});

function rejection(input: ClientContactInput): ApiException {
  try {
    validateClientContact(input);
  } catch (error) {
    if (error instanceof ApiException) return error;
    throw error;
  }
  throw new Error('Se esperaba un rechazo');
}

describe('validateClientContact', () => {
  it('normaliza espacios y pasa el correo a minúsculas', () => {
    expect(validateClientContact(valid())).toEqual({
      firstName: 'Carlos',
      lastName: 'Pérez',
      email: 'carlos.perez@correo.com',
      phone: '0992222222',
      address: 'Av. Amazonas 123',
    });
  });

  it.each([[''], ['   '], [undefined]])('deja la dirección en null cuando llega %j', (address) => {
    expect(validateClientContact(valid({ address })).address).toBeNull();
  });

  it('lista todos los obligatorios vacíos', () => {
    const error = rejection({ firstName: ' ', lastName: '', email: undefined, phone: '' });

    expect(error.message).toBe(CLIENT_MESSAGES.missing);
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('CLIENT_MISSING_FIELDS');
    expect(error.errors).toEqual(['firstName', 'lastName', 'email', 'phone']);
  });

  it('trata como vacío un valor que no es texto', () => {
    expect(rejection(valid({ phone: 991111111 })).errors).toEqual(['phone']);
  });

  it.each([['carlos@'], ['carlos'], [`${'a'.repeat(250)}@correo.com`]])('rechaza el correo %s', (email) => {
    const error = rejection(valid({ email }));

    expect(error.message).toBe(CLIENT_MESSAGES.invalidEmail);
    expect(error.code).toBe('CLIENT_INVALID_EMAIL');
    expect(error.errors).toEqual(['email']);
  });

  it.each([['0991'], ['1992222222'], ['09922222220'], ['099222222a']])('rechaza el teléfono %s', (phone) => {
    const error = rejection(valid({ phone }));

    expect(error.message).toBe(CLIENT_MESSAGES.invalidPhone);
    expect(error.code).toBe('CLIENT_INVALID_PHONE');
    expect(error.errors).toEqual(['phone']);
  });

  it('rechaza solo el nombre que supera 100 caracteres', () => {
    const error = rejection(valid({ lastName: 'P'.repeat(101) }));

    expect(error.message).toBe(CLIENT_MESSAGES.invalidName);
    expect(error.errors).toEqual(['lastName']);
  });

  it('rechaza una dirección de más de 255 caracteres', () => {
    const error = rejection(valid({ address: 'a'.repeat(256) }));

    expect(error.message).toBe(CLIENT_MESSAGES.invalidAddress);
    expect(error.errors).toEqual(['address']);
  });
});
