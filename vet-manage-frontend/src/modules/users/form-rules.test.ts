import { describe, expect, it } from 'vitest';
import { ApiError } from '../../infrastructure/api/http-client';
import {
  buildUserUpdateInput, describeApiError, INVALID_FORMAT, MAIL_FAILED, MISSING_FIELDS, registrationOutcome, sanitizePhone,
  toEditForm,
  validateRegistration, validateUserUpdate,
} from './form-rules';
import type { Form } from './form-rules';

const valid: Form = {
  identification: '1710034065',
  firstName: 'María',
  lastName: 'López',
  email: 'maria@clinica.com',
  phone: '',
  roles: ['veterinarian'],
};

describe('validateRegistration', () => {
  it('no reporta errores con los datos completos', () => {
    expect(validateRegistration(valid)).toEqual({ errors: {}, missing: false });
  });

  it('marca el correo y los roles vacíos con el mensaje de campos obligatorios', () => {
    const { errors, missing } = validateRegistration({ ...valid, email: '  ', roles: [] });

    expect(missing).toBe(true);
    expect(errors).toEqual({ email: MISSING_FIELDS, roles: MISSING_FIELDS });
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

  it('acepta un teléfono opcional con formato válido', () => {
    expect(validateRegistration({ ...valid, phone: '+593991234567' }).errors).toEqual({});
  });
});

describe('describeApiError', () => {
  it('resalta la cédula, el correo o los roles según el código de la API', () => {
    const duplicated = new ApiError('Número de cédula ya registrado', 409, { code: 'USER_IDENTIFICATION_TAKEN' });
    const email = new ApiError('El correo ya se encuentra registrado', 409, { code: 'USER_EMAIL_TAKEN' });
    const roles = new ApiError('Seleccione roles válidos del personal', 400, { code: 'USER_INVALID_ROLES' });

    expect(describeApiError(duplicated)).toEqual({ message: duplicated.message, errors: { identification: duplicated.message } });
    expect(describeApiError(email).errors).toEqual({ email: email.message });
    expect(describeApiError(roles).errors).toEqual({ roles: roles.message });
  });

  it('resalta los campos que la API lista en errors', () => {
    const error = new ApiError(MISSING_FIELDS, 400, { code: 'USER_MISSING_FIELDS', errors: ['email', 'roles', 'otro'] });

    expect(describeApiError(error).errors).toEqual({ email: MISSING_FIELDS, roles: MISSING_FIELDS });
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
      message: 'Usuario registrado correctamente.',
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

describe('validateUserUpdate (HU-53)', () => {
  const edit = { firstName: 'Carlos', lastName: 'Pérez', email: 'cperez@correo.com', phone: '0991111111' };

  it('no reporta errores con datos válidos y el teléfono vacío', () => {
    expect(validateUserUpdate(edit)).toEqual({ errors: {}, missing: false });
    expect(validateUserUpdate({ ...edit, phone: '' })).toEqual({ errors: {}, missing: false });
  });

  it('marca el nombre vacío con "Complete los campos obligatorios"', () => {
    const result = validateUserUpdate({ ...edit, firstName: '  ' });

    expect(result.missing).toBe(true);
    expect(result.errors).toEqual({ firstName: 'Complete los campos obligatorios' });
  });

  it.each([[{ email: 'carlos@' }, 'email'], [{ phone: '0991' }, 'phone'], [{ lastName: 'P'.repeat(101) }, 'lastName']])(
    'marca %j con "Formato no válido"',
    (override, field) => {
      expect(validateUserUpdate({ ...edit, ...override }).errors).toEqual({ [field]: INVALID_FORMAT });
    },
  );
});

describe('buildUserUpdateInput y toEditForm (HU-53)', () => {
  it('recorta los datos', () => {
    expect(buildUserUpdateInput({ firstName: ' Carlos ', lastName: 'Pérez ', email: ' c@x.com', phone: ' ' }))
      .toEqual({ firstName: 'Carlos', lastName: 'Pérez', email: 'c@x.com', phone: '' });
  });

  it('llena el formulario sin nulos', () => {
    expect(toEditForm({ firstName: 'Carlos', lastName: 'Pérez', email: 'c@x.com', phone: null }))
      .toEqual({ firstName: 'Carlos', lastName: 'Pérez', email: 'c@x.com', phone: '' });
  });
});

describe('describeApiError en la edición (HU-53)', () => {
  it('resalta los campos que rechaza la API', () => {
    const invalid = new ApiError('Formato no válido', 400, { code: 'USER_INVALID_PHONE', errors: ['phone'] });
    const taken = new ApiError('El correo ya se encuentra registrado', 409, { code: 'USER_EMAIL_TAKEN', errors: ['email'] });

    expect(describeApiError(invalid).errors).toEqual({ phone: 'Formato no válido' });
    expect(describeApiError(taken).errors).toEqual({ email: 'El correo ya se encuentra registrado' });
  });

  it('muestra el rechazo de un usuario dado de baja sin resaltar campos', () => {
    const deactivated = new ApiError('No se puede actualizar un usuario dado de baja', 409, { code: 'USER_DEACTIVATED' });

    expect(describeApiError(deactivated)).toEqual({ message: deactivated.message, errors: {} });
  });
});

describe('sanitizePhone (HU-53)', () => {
  it.each([
    ['09a9b1c', '0991'],
    ['099 222-2222', '0992222222'],
    ['+593 99 222 2222', '+593992222222'],
    ['59+3', '593'],
    ['++593', '+593'],
    ['1234567890123456789', '1234567890123456'],
    ['+12345678901234567', '+123456789012345'],
    ['abc', ''],
  ])('convierte %j en %j', (value, expected) => {
    expect(sanitizePhone(value)).toBe(expected);
  });
});
