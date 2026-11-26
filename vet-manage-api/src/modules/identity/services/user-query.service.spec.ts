import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueryUsersDto } from '../dtos/query-users.dto.js';
import type { UserQueryRepository, UserQueryRow } from '../repositories/user-query.repository.js';
import { UserQueryService } from './user-query.service.js';

const rows: UserQueryRow[] = [
  {
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
  },
  {
    id: 'u-2',
    identification: '1104567891',
    firstName: 'Ana',
    lastName: 'Pérez',
    email: 'aperez@vetmanage.test',
    roles: [{ name: 'cashier', displayName: 'Cajero' }],
    status: 'INACTIVE',
  },
];

function build() {
  const repository = {
    findMany: vi.fn(async () => rows),
    count: vi.fn(async () => 45),
  };
  return {
    repository,
    service: new UserQueryService(repository as unknown as UserQueryRepository),
  };
}

describe('UserQueryService', () => {
  let ctx: ReturnType<typeof build>;

  beforeEach(() => {
    ctx = build();
  });

  it('devuelve la primera página de 20 usuarios por defecto', async () => {
    const result = await ctx.service.list({});

    expect(result).toEqual({ items: rows, total: 45, page: 1, pageSize: 20 });
    expect(ctx.repository.findMany).toHaveBeenCalledWith({
      q: undefined,
      role: undefined,
      status: undefined,
      page: 1,
      pageSize: 20,
    });
    expect(ctx.repository.count).toHaveBeenCalledWith({
      q: undefined,
      role: undefined,
      status: undefined,
      page: 1,
      pageSize: 20,
    });
  });

  it('pide la página indicada sin perder el total', async () => {
    const result = await ctx.service.list({ page: 2 } as QueryUsersDto);

    expect(ctx.repository.findMany).toHaveBeenCalledWith(expect.objectContaining({ page: 2, pageSize: 20 }));
    expect(result.page).toBe(2);
    expect(result.total).toBe(45);
  });

  it('normaliza la búsqueda recortando espacios', async () => {
    await ctx.service.list({ q: '  1104567890  ' } as QueryUsersDto);

    expect(ctx.repository.findMany).toHaveBeenCalledWith(expect.objectContaining({ q: '1104567890' }));
  });

  it('propaga los filtros de rol y estado', async () => {
    await ctx.service.list({ role: 'veterinarian', status: 'INACTIVE' } as QueryUsersDto);

    expect(ctx.repository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'veterinarian', status: 'INACTIVE' }),
    );
  });

  it('devuelve la lista vacía con el total de coincidencias', async () => {
    ctx.repository.findMany.mockResolvedValueOnce([]);
    ctx.repository.count.mockResolvedValueOnce(0);

    const result = await ctx.service.list({ q: '0000000000' } as QueryUsersDto);

    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
  });

  it('conserva todos los roles del usuario al filtrar por uno', async () => {
    const result = await ctx.service.list({ role: 'veterinarian' } as QueryUsersDto);

    expect(result.items[0]?.roles).toEqual([
      { name: 'veterinarian', displayName: 'Veterinario' },
      { name: 'manager', displayName: 'Gerente' },
    ]);
  });
});
