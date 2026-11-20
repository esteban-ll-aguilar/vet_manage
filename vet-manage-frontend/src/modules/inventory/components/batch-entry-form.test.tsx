import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { BatchEntryForm } from './batch-entry-form';
import type { BatchEntryDraft, Product } from '../types';

const products: Product[] = [{
  id: 'p-1', code: 'PR-001', name: 'Alimento para perro', description: null, unitPrice: '25.50', stock: 10,
  category: { id: 'c-1', name: 'Alimentos' }, brand: { id: 'b-1', name: 'Dog Chow' }, createdAt: '2026-11-19',
}];

type Values = { product?: boolean; code?: string; date?: string; quantity?: string };

function setup(onSubmit = vi.fn<(draft: BatchEntryDraft) => Promise<void>>(async () => undefined)) {
  render(<MemoryRouter><BatchEntryForm products={products} onSubmit={onSubmit} /></MemoryRouter>);
  return onSubmit;
}

async function fill({ product = true, code = 'L-2026-001', date = '2027-10-23', quantity = '50' }: Values = {}) {
  if (product) await userEvent.selectOptions(screen.getByLabelText(/producto/i), 'p-1');
  if (code) await userEvent.type(screen.getByLabelText(/código del lote/i), code);
  if (date) fireEvent.change(screen.getByLabelText(/fecha de caducidad/i), { target: { value: date } });
  if (quantity) await userEvent.type(screen.getByLabelText(/cantidad inicial/i), quantity);
  await userEvent.click(screen.getByRole('button', { name: /registrar entrada/i }));
}

describe('BatchEntryForm (HU-02)', () => {
  it('escenario 1: envía la entrada completa con la cantidad como entero', async () => {
    const onSubmit = setup();
    await fill();

    expect(onSubmit).toHaveBeenCalledWith({ productId: 'p-1', code: 'L-2026-001', expirationDate: '2027-10-23', initialQuantity: 50 });
  });

  it('muestra las existencias actuales de cada producto en el selector', () => {
    setup();
    expect(screen.getByRole('option', { name: /Alimento para perro \(Existencias: 10\)/ })).toBeInTheDocument();
  });

  it.each([
    ['escenario 2: sin producto', { product: false }, 'Debe seleccionar un producto'],
    ['escenario 3: sin código de lote', { code: '' }, 'Debe ingresar el código del lote'],
    ['escenario 4: sin fecha de caducidad', { date: '' }, 'Debe ingresar la fecha de caducidad'],
    ['escenario 5: sin cantidad inicial', { quantity: '' }, 'Debe ingresar la cantidad inicial'],
    ['escenario 6: cantidad cero', { quantity: '0' }, 'La cantidad inicial debe ser mayor que cero'],
    ['escenario 7: cantidad negativa', { quantity: '-5' }, 'La cantidad inicial debe ser mayor que cero'],
    ['escenario 8: cantidad decimal', { quantity: '2.5' }, 'La cantidad inicial debe ser un número entero mayor que cero'],
    ['escenario 8: cantidad con letras', { quantity: 'abc' }, 'La cantidad inicial debe ser un número entero mayor que cero'],
  ])('%s: no envía y muestra el mensaje', async (_name, values: Values, message) => {
    const onSubmit = setup();
    await fill(values);

    expect(screen.getByText(message)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('muestra junto al campo el error devuelto por la API', async () => {
    const onSubmit = setup(vi.fn(async () => {
      throw Object.assign(new Error('El producto seleccionado no existe'), { errors: [] });
    }));
    await fill();

    expect(onSubmit).toHaveBeenCalled();
    expect(await screen.findByText('El producto seleccionado no existe')).toBeInTheDocument();
  });
});
