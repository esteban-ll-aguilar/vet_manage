import { describe, expect, it, vi } from 'vitest';
import { INVENTORY_DEMO, seedInventory } from './inventory.seed.js';

function createPrismaMock() {
  const tx = {
    category: { upsert: vi.fn(async ({ create }: { create: { name: string } }) => ({ id: `category-${create.name}` })) },
    marca: { upsert: vi.fn(async ({ create }: { create: { name: string } }) => ({ id: `brand-${create.name}` })) },
    product: { upsert: vi.fn(async ({ create }: { create: { code: string } }) => ({ id: `product-${create.code}` })) },
  };
  return { tx, prisma: { $transaction: vi.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)) } };
}

describe('Inventory demo seed', () => {
  it('declares demo products with positive prices and catalog references', () => {
    expect(INVENTORY_DEMO.products.length).toBeGreaterThan(0);
    expect(INVENTORY_DEMO.products.every((product) => product.description.trim().length > 0)).toBe(true);
    expect(INVENTORY_DEMO.products.every((product) => product.unitPrice > 0)).toBe(true);
    expect(INVENTORY_DEMO.products.every((product) => INVENTORY_DEMO.categories.some(({ name }) => name === product.category))).toBe(true);
    expect(INVENTORY_DEMO.products.every((product) => INVENTORY_DEMO.brands.some(({ name }) => name === product.brand))).toBe(true);
  });

  it('uses unique natural keys and resolves product relations in one transaction', async () => {
    const { prisma, tx } = createPrismaMock();

    const result = await seedInventory(prisma as never);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.category.upsert).toHaveBeenCalledTimes(INVENTORY_DEMO.categories.length);
    expect(tx.marca.upsert).toHaveBeenCalledTimes(INVENTORY_DEMO.brands.length);
    expect(tx.product.upsert).toHaveBeenCalledTimes(INVENTORY_DEMO.products.length);
    expect(tx.product.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { code: INVENTORY_DEMO.products[0].code },
      update: expect.objectContaining({ categoryId: expect.any(String), brandId: expect.any(String) }),
      create: expect.objectContaining({ description: INVENTORY_DEMO.products[0].description }),
    }));
    expect(result).toEqual({
      categories: INVENTORY_DEMO.categories.length,
      brands: INVENTORY_DEMO.brands.length,
      products: INVENTORY_DEMO.products.length,
    });
  });
});
