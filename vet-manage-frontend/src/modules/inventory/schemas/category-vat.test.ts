import { describe, expect, it } from 'vitest';
import { formatCategoryVat, INVALID_CATEGORY_VAT_MESSAGE, validateCategoryVat } from './category-vat';

describe('category VAT input', () => {
  it.each(['0', '0.01', '12.5', '99.99', '100', '100.00'])('accepts %s', (value) => {
    expect(validateCategoryVat(value)).toBeNull();
  });

  it.each(['', '-5', '100.01', '12.345', 'letras', ' 12.5', '12,5'])('rejects %s', (value) => {
    expect(validateCategoryVat(value)).toBe(INVALID_CATEGORY_VAT_MESSAGE);
  });

  it('formats a configured zero separately from a missing IVA', () => {
    expect(formatCategoryVat('0')).toBe('0 %');
    expect(formatCategoryVat(null)).toBe('Sin configurar');
    expect(formatCategoryVat('12.50')).toBe('12.5 %');
  });
});
