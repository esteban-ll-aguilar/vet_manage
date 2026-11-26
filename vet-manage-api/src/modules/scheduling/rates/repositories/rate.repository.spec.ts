import { describe, expect, it, vi } from 'vitest';
import { RateRepository } from './rate.repository.js';

function build() {
  const transaction = {
    tarifa: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockResolvedValue({ id: 'rate-1', importe: 20, estado: true }),
    },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction)),
    tarifa: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
    },
    servicio: {
      update: vi.fn().mockResolvedValue({ id: 'service-1', estado: true }),
    },
  };
  return { repository: new RateRepository(prisma as never), prisma, transaction };
}

describe('RateRepository', () => {
  it('persiste la tarifa y desactiva la anterior en una transacción de Prisma', async () => {
    const ctx = build();

    await expect(ctx.repository.upsert('service-1', 'branch-1', 20))
      .resolves.toMatchObject({ id: 'rate-1', importe: 20 });

    expect(ctx.prisma.$transaction).toHaveBeenCalledOnce();
    expect(ctx.transaction.tarifa.updateMany).toHaveBeenCalledWith({
      where: { servicioId: 'service-1', sucursalId: 'branch-1', estado: true },
      data: { estado: false },
    });
    expect(ctx.transaction.tarifa.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { servicioId: 'service-1', sucursalId: 'branch-1', importe: 20 },
    }));
  });

  it('consulta desde PostgreSQL todos los registros por defecto sin filtrar estado', async () => {
    const ctx = build();

    await ctx.repository.findMany();

    expect(ctx.prisma.tarifa.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {},
      orderBy: [{ sucursalId: 'asc' }, { servicioId: 'asc' }, { fechaVigencia: 'desc' }],
    }));
  });

  it('activa el servicio persistiendo su estado en Prisma', async () => {
    const ctx = build();

    await ctx.repository.activateService('service-1');

    expect(ctx.prisma.servicio.update).toHaveBeenCalledWith({
      where: { id: 'service-1' },
      data: { estado: true },
      select: { id: true, nombre: true, estado: true },
    });
  });
});
