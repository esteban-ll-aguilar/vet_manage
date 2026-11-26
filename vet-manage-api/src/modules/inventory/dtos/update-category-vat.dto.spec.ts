import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UpdateCategoryVatDto } from './update-category-vat.dto.js';

describe('UpdateCategoryVatDto', () => {
  it.each(['0', '0.01', '12.5', '99.99', '100'])('accepts %s as a VAT percentage', async (vatRate) => {
    const input = Object.assign(new UpdateCategoryVatDto(), { vatRate });

    await expect(validate(input)).resolves.toHaveLength(0);
  });

  it.each(['', null, 'texto', '-5', '100.01', '12.345', 12.5, undefined])(
    'rejects unsupported VAT input %s',
    async (vatRate) => {
      const input = Object.assign(new UpdateCategoryVatDto(), { vatRate });

      await expect(validate(input)).resolves.not.toHaveLength(0);
    },
  );
});
