import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateRateDto, INVALID_RATE_MESSAGE, REQUIRED_RATE_MESSAGE } from './create-rate.dto.js';

async function errorsFor(importe: unknown) {
  const dto = Object.assign(new CreateRateDto(), {
    servicioId: '550e8400-e29b-41d4-a716-446655440000',
    sucursalId: '550e8400-e29b-41d4-a716-446655440001',
    importe,
  });
  return validate(dto);
}

describe('CreateRateDto', () => {
  it('CP-025-04 rechaza importe cero', async () => {
    const errors = await errorsFor(0);
    expect(errors[0].constraints).toHaveProperty('validRateAmount', INVALID_RATE_MESSAGE);
  });

  it('CP-025-05 rechaza importe negativo', async () => {
    const errors = await errorsFor(-5);
    expect(errors[0].constraints).toHaveProperty('validRateAmount', INVALID_RATE_MESSAGE);
  });

  it('CP-025-06 rechaza texto', async () => {
    const errors = await errorsFor('abc');
    expect(errors[0].constraints).toHaveProperty('validRateAmount', INVALID_RATE_MESSAGE);
  });

  it('CP-025-07 rechaza tres decimales', async () => {
    const errors = await errorsFor(20.005);
    expect(errors[0].constraints).toHaveProperty('validRateAmount', INVALID_RATE_MESSAGE);
  });

  it('CP-025-08 rechaza importe vacío', async () => {
    const errors = await errorsFor('');
    expect(errors[0].constraints).toHaveProperty('validRateAmount', REQUIRED_RATE_MESSAGE);
  });

  it('CP-025-01 acepta USD 20 con hasta dos decimales', async () => {
    await expect(errorsFor(20)).resolves.toEqual([]);
  });
});
