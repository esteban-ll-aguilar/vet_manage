import { describe, expect, it, vi } from 'vitest';
import { SuppliersRepository } from './suppliers.repository.js';

const now = new Date('2026-11-20T10:00:00.000Z');
const sample = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  businessName: 'Distribuidora Vet',
  ruc: '0012345678001',
  isActive: true,
  createdAt: now,
  updatedAt: now,
};

function build() {
  const supplier = {
    create: vi.fn(async () => sample),
    findMany: vi.fn(async () => [sample]),
    findUnique: vi.fn(async () => sample),
    update: vi.fn(async () => sample),
    count: vi.fn(async () => 1),
  };
  const prisma = {
    supplier,
    $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
  };
  return { repository: new SuppliersRepository(prisma as never), prisma };
}

describe('SuppliersRepository', () => {
  it('crea explícitamente el proveedor con estado activo', async () => {
    const ctx = build();

    await ctx.repository.create({ businessName: sample.businessName, ruc: sample.ruc });

    expect(ctx.prisma.supplier.create).toHaveBeenCalledWith({
      data: { businessName: sample.businessName, ruc: sample.ruc, isActive: true },
      select: { id: true, businessName: true, ruc: true, isActive: true, createdAt: true, updatedAt: true },
    });
  });

  it('lista con paginación, búsqueda, estado y conteo en una transacción Prisma', async () => {
    const ctx = build();

    await ctx.repository.findSuppliers({ page: 3, pageSize: 5, search: '  Vet  ', status: 'INACTIVE' });

    const expectedWhere = {
      isActive: false,
      OR: [
        { businessName: { contains: 'Vet', mode: 'insensitive' } },
        { ruc: { contains: 'Vet', mode: 'insensitive' } },
      ],
    };
    expect(ctx.prisma.supplier.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expectedWhere,
      skip: 10,
      take: 5,
    }));
    expect(ctx.prisma.supplier.count).toHaveBeenCalledWith({ where: expectedWhere });
    expect(ctx.prisma.$transaction).toHaveBeenCalledOnce();
  });

  it('consulta por identificador y por RUC usando selectores mínimos', async () => {
    const ctx = build();

    await ctx.repository.findById(sample.id);
    await ctx.repository.findByRuc(sample.ruc);

    expect(ctx.prisma.supplier.findUnique).toHaveBeenNthCalledWith(1, {
      where: { id: sample.id },
      select: { id: true, businessName: true, ruc: true, isActive: true, createdAt: true, updatedAt: true },
    });
    expect(ctx.prisma.supplier.findUnique).toHaveBeenNthCalledWith(2, {
      where: { ruc: sample.ruc },
      select: { id: true },
    });
  });

  it('actualiza por UUID explícito y no permite que el repositorio reciba datos de estado arbitrarios', async () => {
    const ctx = build();

    await ctx.repository.update(sample.id, { businessName: 'Actualizado' });

    expect(ctx.prisma.supplier.update).toHaveBeenCalledWith({
      where: { id: sample.id },
      data: { businessName: 'Actualizado' },
      select: { id: true, businessName: true, ruc: true, isActive: true, createdAt: true, updatedAt: true },
    });
  });
});
