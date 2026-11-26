import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ListProductsQueryDto } from './list-products-query.dto.js';

describe('ListProductsQueryDto', () => {
  it('acepta una consulta del catálogo sin filtros', () => {
    expect(validateSync(new ListProductsQueryDto())).toEqual([]);
  });

  it('acepta nombre, referencias UUID y precio exacto combinados', () => {
    const consulta = plainToInstance(ListProductsQueryDto, {
      name: 'Alimento',
      categoryId: '38026d50-937e-4e2a-a555-2d23ca206151',
      brandId: '898376a6-a6b3-4f1b-99ac-983071f9f5bf',
      brandName: 'Chow',
      batchCode: 'L-2026-001',
      unitPrice: '25.50',
    });

    expect(validateSync(consulta)).toEqual([]);
  });

  it.each([
    ['search', ['alimento', 'perro']],
    ['name', 'x'.repeat(151)],
    ['categoryId', 'Alimentos'],
    ['brandId', 'Dog Chow'],
    ['brandName', 'x'.repeat(101)],
    ['batchCode', 'x'.repeat(51)],
    ['batchCode', ['L-001', 'L-002']],
    ['unitPrice', ''],
    ['unitPrice', '-4.50'],
    ['unitPrice', '25.555'],
    ['unitPrice', '10000000000.00'],
    ['unitPrice', ['25', '30']],
  ])('rechaza el filtro %s con valor inválido (%j)', (propiedad, valor) => {
    const consulta = plainToInstance(ListProductsQueryDto, { [propiedad]: valor });

    expect(validateSync(consulta)).toEqual([expect.objectContaining({ property: propiedad })]);
  });
});
