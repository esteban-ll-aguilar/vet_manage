import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../infrastructure/api/http-client';
import {
  buildSupplierInput,
  supplierApiErrorMessage,
  supplierApiFieldErrors,
  SUPPLIER_RUC_FORMAT_ERROR,
  validateSupplierDraft,
} from './supplier';

describe('supplier form rules', () => {
  it('requires a business name and an RUC with exactly 13 numeric digits', () => {
    expect(validateSupplierDraft({ businessName: '  ', ruc: '  ' })).toEqual({
      businessName: 'La razón social es obligatoria.',
      ruc: 'El RUC es obligatorio.',
    });
    expect(validateSupplierDraft({ businessName: 'Empresa', ruc: '' })).toEqual({ ruc: 'El RUC es obligatorio.' });
    expect(validateSupplierDraft({ businessName: 'Empresa', ruc: '0012345678001' })).toEqual({});
  });

  it.each(['123456789012', '12345678901234', '123456789012A', '12345678901 3']) (
    'rejects RUC values that are not 13 numeric digits: %s', (ruc) => {
      expect(validateSupplierDraft({ businessName: 'Empresa', ruc })).toEqual({ ruc: SUPPLIER_RUC_FORMAT_ERROR });
    },
  );

  it('trims outer whitespace but preserves a 13-digit RUC as text including zeroes', () => {
    expect(buildSupplierInput({ businessName: ' Empresa ', ruc: ' 0001234567890 ' })).toEqual({
      businessName: 'Empresa',
      ruc: '0001234567890',
    });
  });

  it.each([
    [400, 'Corrija los campos enviados.'],
    [403, 'No tiene permisos para realizar esta acción.'],
    [404, 'No se encontró el proveedor. Actualice el listado e inténtelo nuevamente.'],
    [409, 'El RUC ya está registrado.'],
  ])('presenta un mensaje controlado para HTTP %s', (status, message) => {
    const error = new ApiError('El RUC ya está registrado.', status);

    expect(supplierApiErrorMessage(error, 'Error')).toBe(status === 400 ? error.message : message);
  });

  it('asocia los conflictos 409 al campo RUC', () => {
    expect(supplierApiFieldErrors(new ApiError('El RUC ya está registrado.', 409))).toEqual({
      ruc: 'El RUC ya está registrado.',
    });
  });
});
