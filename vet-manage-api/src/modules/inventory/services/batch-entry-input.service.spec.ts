import { describe, expect, it } from 'vitest';
import { BATCH_ENTRY_MESSAGES as M, validateBatchEntryInput } from './batch-entry-input.service.js';

const PRODUCT_ID = '123e4567-e89b-12d3-a456-426614174000';
const valid = { productId: PRODUCT_ID, code: 'L-2026-001', expirationDate: '2027-10-23', initialQuantity: 50 };

describe('validateBatchEntryInput (HU-02)', () => {
  it('escenario 1: acepta una entrada completa y normaliza los datos', () => {
    const result = validateBatchEntryInput({ ...valid, code: '  L-2026-001  ', initialQuantity: '50' });

    expect(result.valid).toBe(true);
    expect(result.value).toEqual({
      productId: PRODUCT_ID,
      code: 'L-2026-001',
      expirationDate: new Date(Date.UTC(2027, 9, 23)),
      initialQuantity: 50,
    });
  });

  it('escenario 2: exige seleccionar un producto', () => {
    expect(validateBatchEntryInput({ ...valid, productId: '' }).errors).toEqual({ productId: M.productRequired });
    expect(validateBatchEntryInput({ ...valid, productId: undefined }).errors).toEqual({ productId: M.productRequired });
    expect(validateBatchEntryInput({ ...valid, productId: 'no-es-uuid' }).errors).toEqual({ productId: M.productRequired });
  });

  it('escenario 3: exige el código del lote', () => {
    expect(validateBatchEntryInput({ ...valid, code: '   ' }).errors).toEqual({ code: M.codeRequired });
    expect(validateBatchEntryInput({ ...valid, code: 'x'.repeat(51) }).errors).toEqual({ code: M.codeTooLong });
  });

  it('escenario 4: exige una fecha de caducidad válida', () => {
    expect(validateBatchEntryInput({ ...valid, expirationDate: '' }).errors).toEqual({ expirationDate: M.expirationRequired });
    expect(validateBatchEntryInput({ ...valid, expirationDate: '2027-02-30' }).errors).toEqual({ expirationDate: M.expirationInvalid });
    expect(validateBatchEntryInput({ ...valid, expirationDate: '23/10/2027' }).errors).toEqual({ expirationDate: M.expirationInvalid });
  });

  it('escenario 5: exige la cantidad inicial', () => {
    for (const initialQuantity of [undefined, null, '', '  ']) {
      expect(validateBatchEntryInput({ ...valid, initialQuantity }).errors).toEqual({ initialQuantity: M.quantityRequired });
    }
  });

  it('escenarios 6 y 7: rechaza cero y negativos', () => {
    for (const initialQuantity of [0, '0', -5, '-5']) {
      expect(validateBatchEntryInput({ ...valid, initialQuantity }).errors).toEqual({ initialQuantity: M.quantityNotPositive });
    }
  });

  it('escenario 8: rechaza decimales y letras', () => {
    for (const initialQuantity of [2.5, '2.5', 'abc', '5abc', '1e3', true]) {
      expect(validateBatchEntryInput({ ...valid, initialQuantity }).errors).toEqual({ initialQuantity: M.quantityNotInteger });
    }
  });

  it('informa todos los campos faltantes a la vez', () => {
    const result = validateBatchEntryInput({});

    expect(result.valid).toBe(false);
    expect(Object.keys(result.errors).sort()).toEqual(['code', 'expirationDate', 'initialQuantity', 'productId']);
  });
});
