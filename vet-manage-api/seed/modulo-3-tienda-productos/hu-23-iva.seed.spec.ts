import { describe, expect, it, vi } from 'vitest';
import { HU23_IVA_DEMO, seedHu23Iva } from './hu-23-iva.seed.js';

function createPrismaMock() {
  const tx = {
    category: {
      upsert: vi.fn(async ({ create }: { create: { name: string } }) => ({
        id: `category-${create.name}`,
      })),
    },
    marca: {
      upsert: vi.fn(async ({ create }: { create: { name: string } }) => ({
        id: `brand-${create.name}`,
      })),
    },
    product: {
      upsert: vi.fn(async ({ create }: { create: { code: string } }) => ({
        id: `product-${create.code}`,
      })),
    },
  };

  return {
    tx,
    prisma: {
      $transaction: vi.fn((callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
      ),
    },
  };
}

describe('HU-23 IVA demo seed', () => {
  it('declares the required categories, VAT rates and products', () => {
    expect(HU23_IVA_DEMO.categories).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Accesorios', vatRate: '12' }),
      expect.objectContaining({ name: 'Medicina', vatRate: '0' }),
      expect.objectContaining({ name: 'Alimentos', vatRate: '12' }),
    ]));
    expect(HU23_IVA_DEMO.products).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'Collar para perro',
        unitPrice: '20.00',
        category: 'Accesorios',
      }),
      expect.objectContaining({
        name: 'Vitaminas Caninas',
        unitPrice: '10.00',
        category: 'Medicina',
      }),
    ]));
  });

  it('creates each reference once in a single transaction', async () => {
    const { prisma, tx } = createPrismaMock();

    await expect(seedHu23Iva(prisma as never)).resolves.toEqual({
      categories: HU23_IVA_DEMO.categories.length,
      brands: HU23_IVA_DEMO.brands.length,
      products: HU23_IVA_DEMO.products.length,
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.category.upsert).toHaveBeenCalledTimes(HU23_IVA_DEMO.categories.length);
    expect(tx.marca.upsert).toHaveBeenCalledTimes(HU23_IVA_DEMO.brands.length);
    expect(tx.product.upsert).toHaveBeenCalledTimes(HU23_IVA_DEMO.products.length);
  });
});
