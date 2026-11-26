import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserQueryRepository } from './user-query.repository.js';

function build() {
  const prisma = {
    user: {
      findMany: vi.fn(async () => [
        {
          id: 'u-1',
          status: 'ACTIVE',
          person: {
            identification: '1104567890',
            firstName: 'Carlos',
            lastName: 'Pérez',
            email: 'cperez@vetmanage.test',
          },
          userRoles: [
            { role: { name: 'veterinarian', displayName: 'Veterinario' } },
            { role: { name: 'manager', displayName: 'Gerente' } },
          ],
        },
      ]),
      count: vi.fn(async () => 45),
    },
  };
  return { prisma, repository: new UserQueryRepository(prisma as never) };
}

describe('UserQueryRepository', () => {
  let ctx: ReturnType<typeof build>;

  beforeEach(() => {
    ctx = build();
  });

  it('ordena por apellido y nombre y toma 20 filas desde la página pedida', async () => {
    await ctx.repository.findMany({ page: 2, pageSize: 20 });

    expect(ctx.prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        orderBy: [{ person: { lastName: 'asc' } }, { person: { firstName: 'asc' } }],
        skip: 20,
        take: 20,
      }),
    );
  });

  it('busca por cédula exacta y por nombre parcial insensible a mayúsculas', async () => {
    await ctx.repository.findMany({ q: 'Pérez', page: 1, pageSize: 20 });

    expect(ctx.prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { person: { identification: { equals: 'Pérez', mode: 'insensitive' } } },
            { person: { firstName: { contains: 'Pérez', mode: 'insensitive' } } },
            { person: { lastName: { contains: 'Pérez', mode: 'insensitive' } } },
          ],
        },
      }),
    );
  });

  it('combina rol, estado y búsqueda en el mismo filtro de la lista y del total', async () => {
    const filter = { q: 'Ana', role: 'veterinarian', status: 'ACTIVE' as const, page: 1, pageSize: 20 };

    await ctx.repository.findMany(filter);
    await ctx.repository.count(filter);

    const where = {
      OR: [
        { person: { identification: { equals: 'Ana', mode: 'insensitive' } } },
        { person: { firstName: { contains: 'Ana', mode: 'insensitive' } } },
        { person: { lastName: { contains: 'Ana', mode: 'insensitive' } } },
      ],
      userRoles: { some: { role: { name: 'veterinarian', isActive: true } } },
      status: 'ACTIVE',
    };
    expect(ctx.prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
    expect(ctx.prisma.user.count).toHaveBeenCalledWith({ where });
  });

  it('proyecta solo los campos públicos y conserva todos los roles', async () => {
    const [item] = await ctx.repository.findMany({ page: 1, pageSize: 20 });

    expect(item).toEqual({
      id: 'u-1',
      identification: '1104567890',
      firstName: 'Carlos',
      lastName: 'Pérez',
      email: 'cperez@vetmanage.test',
      roles: [
        { name: 'veterinarian', displayName: 'Veterinario' },
        { name: 'manager', displayName: 'Gerente' },
      ],
      status: 'ACTIVE',
    });
    expect(item).not.toHaveProperty('password');
  });
});
