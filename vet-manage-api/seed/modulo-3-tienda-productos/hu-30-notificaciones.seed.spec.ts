import { describe, expect, it, vi } from 'vitest';
import {
  HU30_NOTIFICATIONS_DEMO,
  seedHu30Notifications,
} from './hu-30-notificaciones.seed.js';

function createPrismaMock() {
  const tx = {
    person: {
      findUnique: vi.fn(async ({ where }: { where: { email: string } }) => ({
        user: { id: `user-${where.email}` },
      })),
    },
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
      findFirst: vi.fn(async ({ where }: { where: { name: string } }) => ({
        id: `product-${where.name}`,
      })),
      upsert: vi.fn(async ({ create }: { create: { code: string } }) => ({
        id: `product-${create.code}`,
      })),
    },
    batch: {
      findFirst: vi.fn(async ({ where }: { where: { code: string } }) => ({
        id: `batch-${where.code}`,
      })),
      update: vi.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id })),
      create: vi.fn(async ({ data }: { data: { code: string } }) => ({ id: `batch-${data.code}` })),
    },
    notificationType: {
      upsert: vi.fn(async () => ({ id: 'notification-type-inventory' })),
    },
    notification: {
      upsert: vi.fn(async ({ create }: { create: { id: string } }) => ({ id: create.id })),
    },
  };

  return {
    tx,
    prisma: {
      $transaction: vi.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    },
  };
}

describe('HU-30 notifications demo seed', () => {
  it('declares the required lot and product records', () => {
    expect(HU30_NOTIFICATIONS_DEMO.lots.map((lot) => lot.code)).toEqual([
      'LOT-101',
      'LOT-102',
      'LOT-103',
      'LOT-104',
      'LOT-105',
    ]);
    expect(HU30_NOTIFICATIONS_DEMO.products.map((product) => product.name)).toEqual(
      expect.arrayContaining([
        'Antiparasitario',
        'Analgésico',
        'Antibiótico',
        'Vitaminas',
        'Suplemento',
      ]),
    );
  });

  it('creates related inventory records and notifications in one transaction', async () => {
    const { prisma, tx } = createPrismaMock();

    await expect(seedHu30Notifications(prisma as never)).resolves.toMatchObject({
      products: HU30_NOTIFICATIONS_DEMO.products.length,
      lots: HU30_NOTIFICATIONS_DEMO.lots.length,
      notifications: 6,
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.batch.update).toHaveBeenCalledTimes(HU30_NOTIFICATIONS_DEMO.lots.length);
    expect(tx.notification.upsert).toHaveBeenCalledTimes(6);
  });
});
