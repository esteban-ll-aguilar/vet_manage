import { describe, expect, it } from 'vitest';
import { ApiError } from '../../infrastructure/api/http-client';
import {
  buildClientInput, describeApiError, INVALID_ADDRESS, MAIL_FAILED, MISSING_FIELDS, registrationOutcome, validateRegistration,
} from './form-rules';
import type { Form } from './form-rules';

const valid: Form = {
  identification: '1710034065',
  firstName: 'María',
  lastName: 'López',
  email: 'maria@clinica.com',
  phone: '',
  address: '',
};

describe('validateRegistration', () => {
  it('no reporta errores con los datos completos', () => {
    expect(validateRegistration(valid)).toEqual({ errors: {}, missing: false });
  });

  it('marca los campos obligatorios vacíos con el mensaje de campos obligatorios', () => {
    const { errors, missing } = validateRegistration({ ...valid, firstName: '  ', email: '  ' });

    expect(missing).toBe(true);
    expect(errors).toEqual({ firstName: MISSING_FIELDS, email: MISSING_FIELDS });
  });

  it('rechaza una cédula corta o con verificador incorrecto', () => {
    for (const identification of ['11045', '1104567890']) {
      const { errors, missing } = validateRegistration({ ...valid, identification });

      expect(missing).toBe(false);
      expect(errors.identification).toBe('La cédula debe tener 10 dígitos válidos');
    }
  });

  it('rechaza un correo y un teléfono con formato inválido', () => {
    const { errors } = validateRegistration({ ...valid, email: 'ana@clinica', phone: '12ab' });

    expect(errors).toEqual({ email: 'Ingrese un correo electrónico válido', phone: 'Ingrese un teléfono válido' });
  });

  it('rechaza una dirección que supera el máximo permitido', () => {
    const { errors } = validateRegistration({ ...valid, address: 'a'.repeat(256) });

    expect(errors.address).toBe(INVALID_ADDRESS);
  });

  it('acepta teléfono y dirección opcionales válidos', () => {
    expect(validateRegistration({ ...valid, phone: '+593991234567', address: 'Av. Amazonas 123' }).errors).toEqual({});
  });
});

describe('buildClientInput', () => {
  it('recorta los datos, omite los opcionales vacíos y envía siempre el rol cliente', () => {
    expect(buildClientInput(valid)).toEqual({
      identification: '1710034065',
      firstName: 'María',
      lastName: 'López',
      email: 'maria@clinica.com',
      phone: undefined,
      address: undefined,
      roles: ['client'],
    });
  });

  it('incluye la dirección y el teléfono cuando se ingresan', () => {
    const input = buildClientInput({ ...valid, phone: ' 0991234567 ', address: ' Av. Amazonas 123 ' });

    expect(input.phone).toBe('0991234567');
    expect(input.address).toBe('Av. Amazonas 123');
    expect(input.roles).toEqual(['client']);
  });
});

describe('describeApiError', () => {
  it('resalta la cédula o el correo según el código de la API', () => {
    const duplicated = new ApiError('Número de cédula ya registrado', 409, { code: 'CLIENT_IDENTIFICATION_TAKEN' });
    const email = new ApiError('El correo ya se encuentra registrado', 409, { code: 'CLIENT_EMAIL_TAKEN' });

    expect(describeApiError(duplicated)).toEqual({ message: duplicated.message, errors: { identification: duplicated.message } });
    expect(describeApiError(email).errors).toEqual({ email: email.message });
  });

  it('resalta teléfono, dirección y nombres según el código de la API', () => {
    const phone = new ApiError('Ingrese un teléfono válido', 400, { code: 'CLIENT_INVALID_PHONE' });
    const address = new ApiError(INVALID_ADDRESS, 400, { code: 'CLIENT_INVALID_ADDRESS' });
    const name = new ApiError('Los nombres y apellidos no pueden superar 100 caracteres', 400, { code: 'CLIENT_INVALID_NAME' });

    expect(describeApiError(phone).errors).toEqual({ phone: phone.message });
    expect(describeApiError(address).errors).toEqual({ address: address.message });
    expect(describeApiError(name).errors).toEqual({ firstName: name.message, lastName: name.message });
  });

  it('resalta los campos que la API lista en errors', () => {
    const error = new ApiError(MISSING_FIELDS, 400, { code: 'CLIENT_MISSING_FIELDS', errors: ['email', 'address', 'otro'] });

    expect(describeApiError(error).errors).toEqual({ email: MISSING_FIELDS, address: MISSING_FIELDS });
  });

  it('informa de la falta de conexión ante un error desconocido', () => {
    expect(describeApiError(new TypeError('Failed to fetch'))).toEqual({
      message: 'No se pudo conectar con el servidor. Intente nuevamente.',
      errors: {},
    });
  });
});

describe('registrationOutcome', () => {
  it('es un éxito cuando se enviaron las credenciales', () => {
    expect(registrationOutcome({ existingPerson: false, passwordAssigned: true, credentialsSent: true })).toEqual({
      type: 'success',
      message: 'Cliente registrado correctamente.',
    });
  });

  it('advierte cuando no se pudo enviar el correo', () => {
    expect(registrationOutcome({ existingPerson: false, passwordAssigned: true, credentialsSent: false })).toEqual({
      type: 'warning',
      message: MAIL_FAILED,
    });
  });

  it('indica que se reutilizó a la persona y no advierte si no había credenciales que enviar', () => {
    const outcome = registrationOutcome({ existingPerson: true, passwordAssigned: false, credentialsSent: false });

    expect(outcome.type).toBe('success');
    expect(outcome.message).toContain('La persona ya existía');
  });
});
