import { describe, expect, it } from 'vitest';
import { validateProductInput } from './product-input.service.js';

describe('validateProductInput', () => {
  it('accepts a valid product with a description', () => {
    expect(validateProductInput({
      code: 'PR-001',
      name: 'Alimento para perro',
      description: 'Alimento completo para perro',
      unitPrice: 25.5,
      category: { name: 'Alimentos' },
      brand: { name: 'Dog Chow' },
    })).toEqual({ valid: true, errors: {} });
  });

  it('rejects an empty description', () => {
    expect(validateProductInput({
      code: 'PR-001',
      name: 'Alimento para perro',
      description: '   ',
      unitPrice: 25.5,
      category: { name: 'Alimentos' },
      brand: { name: 'Dog Chow' },
    })).toEqual({
      valid: false,
      errors: { description: 'La descripción es obligatoria' },
    });
  });

  it('identifies every missing required field', () => {
    expect(validateProductInput({
      code: '',
      name: '',
      unitPrice: 0,
      category: {},
      brand: {},
    })).toEqual({
      valid: false,
      errors: {
        code: 'El código es obligatorio',
        name: 'El nombre es obligatorio',
        description: 'La descripción es obligatoria',
        unitPrice: 'El precio unitario debe ser mayor que cero',
        category: 'La categoría es obligatoria',
        brand: 'La marca es obligatoria',
      },
    });
  });

  it('rejects zero and negative prices with the same message', () => {
    expect(validateProductInput({
      code: 'PR-001', name: 'Producto', unitPrice: -1,
      category: { name: 'Alimentos' }, brand: { name: 'Dog Chow' },
    }).errors.unitPrice).toBe('El precio unitario debe ser mayor que cero');
  });
});
