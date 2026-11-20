import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ListClientsQueryDto } from '../dtos/list-clients-query.dto.js';
import { ClientsRepository, type ClientWithPerson } from './clients.repository.js';

const clientRecord = (): ClientWithPerson => ({
  id: 'c1',
  personId: 'p1',
  status: 'ACTIVE',
  createdAt: new Date('2026-11-19T12:00:00.000Z'),
  person: {
    identification: '1710034065',
    firstName: 'María',
    lastName: 'López',
    email: 'maria@example.com',
    phone: '0991234567',
    address: 'Av. Principal 123',
    user: {
      userRoles: [{ role: { name: 'client', displayName: 'Cliente' } }],
    },
  },
});

function build() {
  const findMany = vi.fn(async () => [clientRecord()]);
  const count = vi.fn(async () => 1);
  const prisma = {
    client: { findMany, count },
    $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
  };
  const repository = new ClientsRepository(prisma as never);
  return { repository, prisma, findMany, count };
}

const query = (overrides: Partial<ListClientsQueryDto> = {}): ListClientsQueryDto => ({
  page: 1,
  pageSize: 20,
  ...overrides,
});

describe('ClientsRepository', () => {
  let ctx: ReturnType<typeof build>;

  beforeEach(() => {
    ctx = build();
  });

  it('aplica paginación por defecto y orden por apellido y nombre', async () => {
    const result = await ctx.repository.findClients(query());

    const args = ctx.findMany.mock.calls[0][0];
    expect(args.skip).toBe(0);
    expect(args.take).toBe(20);
    expect(args.orderBy).toEqual([{ person: { lastName: 'asc' } }, { person: { firstName: 'asc' } }]);
    expect(args.where.status).toBeUndefined();
    expect(args.where.person.OR).toBeUndefined();
    expect(result).toEqual({ clients: [clientRecord()], total: 1 });
  });

  it('combina búsqueda insensible, filtro por estado y paginación explícita', async () => {
    await ctx.repository.findClients(query({ page: 2, pageSize: 10, search: '  mar  ', status: 'ACTIVE' }));

    const args = ctx.findMany.mock.calls[0][0];
    expect(args.skip).toBe(10);
    expect(args.take).toBe(10);
    expect(args.where.status).toBe('ACTIVE');
    expect(args.where.person.OR).toContainEqual({ firstName: { contains: 'mar', mode: 'insensitive' } });
    expect(args.where.person.OR).toContainEqual({ lastName: { contains: 'már', mode: 'insensitive' } });
    expect(ctx.count).toHaveBeenCalledWith({ where: args.where });
  });

  it('filtra únicamente roles client activos no vencidos', async () => {
    await ctx.repository.findClients(query());

    const args = ctx.findMany.mock.calls[0][0];
    expect(args.where.person.user.userRoles.some).toEqual({
      role: { name: 'client', isActive: true },
      OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }],
    });
    expect(args.include.person.include.user.include.userRoles.where).toEqual({
      role: { isActive: true },
      OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }],
    });
  });

  it('busca la cédula por igualdad exacta cuando el término tiene 10 dígitos', async () => {
    await ctx.repository.findClients(query({ search: '0961447281' }));

    const args = ctx.findMany.mock.calls[0][0];
    expect(args.where.person.OR).toEqual([{ identification: { equals: '0961447281' } }]);
    expect(ctx.count).toHaveBeenCalledWith({ where: args.where });
  });

  it('genera variantes con y sin tilde para la búsqueda parcial de nombres', async () => {
    await ctx.repository.findClients(query({ search: 'jose' }));

    const conditions = ctx.findMany.mock.calls[0][0].where.person.OR;
    expect(conditions).toContainEqual({ firstName: { contains: 'jose', mode: 'insensitive' } });
    expect(conditions).toContainEqual({ firstName: { contains: 'josé', mode: 'insensitive' } });
    expect(conditions).toContainEqual({ lastName: { contains: 'jose', mode: 'insensitive' } });
    expect(conditions).toContainEqual({ lastName: { contains: 'josé', mode: 'insensitive' } });
    expect(conditions.some((condition: { identification?: unknown }) => condition.identification)).toBe(false);
  });

  it('acepta términos con tilde y con mayúsculas como variantes equivalentes', async () => {
    await ctx.repository.findClients(query({ search: '  JOSÉ  ' }));

    const conditions = ctx.findMany.mock.calls[0][0].where.person.OR;
    expect(conditions).toContainEqual({ firstName: { contains: 'jose', mode: 'insensitive' } });
    expect(conditions).toContainEqual({ firstName: { contains: 'josé', mode: 'insensitive' } });
  });

  it('limita el número de variantes para términos largos', async () => {
    await ctx.repository.findClients(query({ search: 'áéíóúáéíóú' }));

    const conditions = ctx.findMany.mock.calls[0][0].where.person.OR;
    expect(conditions.length).toBeLessThanOrEqual(128);
    expect(conditions.length).toBeGreaterThan(0);
  });

  it('devuelve lista vacía y total cero cuando no hay coincidencias', async () => {
    ctx.findMany.mockResolvedValue([]);
    ctx.count.mockResolvedValue(0);

    const result = await ctx.repository.findClients(query({ search: 'nadie' }));

    expect(result).toEqual({ clients: [], total: 0 });
  });
});

describe('ClientsRepository.findById', () => {
  it('devuelve solo el id y el estado del cliente', async () => {
    const findUnique = vi.fn(async () => ({ id: 'c1', status: 'DEACTIVATED' }));
    const repository = new ClientsRepository({ client: { findUnique } } as never);

    await expect(repository.findById('c1')).resolves.toEqual({ id: 'c1', status: 'DEACTIVATED' });
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'c1' }, select: { id: true, status: true } });
  });
});

describe('ClientsRepository.findPetsByClientId', () => {
  const petRecord = () => ({
    id: 'pet1',
    code: 'PAC-000001',
    name: 'Firulais',
    status: 'ACTIVE' as const,
    species: { name: 'Canino' },
    breed: { name: 'Labrador' },
  });

  it('valida al cliente y devuelve sus mascotas ordenadas por nombre', async () => {
    const findUnique = vi.fn(async () => ({ id: 'c1', status: 'ACTIVE' }));
    const findMany = vi.fn(async () => [petRecord()]);
    const repository = new ClientsRepository({ client: { findUnique }, patient: { findMany } } as never);

    await expect(repository.findPetsByClientId('c1')).resolves.toEqual([petRecord()]);
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'c1' }, select: { id: true, status: true } });
    expect(findMany).toHaveBeenCalledWith({
      where: { clientId: 'c1' },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        species: { select: { name: true } },
        breed: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });
  });

  it('devuelve una lista vacía cuando el cliente no tiene mascotas', async () => {
    const findUnique = vi.fn(async () => ({ id: 'c1', status: 'ACTIVE' }));
    const findMany = vi.fn(async () => []);
    const repository = new ClientsRepository({ client: { findUnique }, patient: { findMany } } as never);

    await expect(repository.findPetsByClientId('c1')).resolves.toEqual([]);
  });

  it('devuelve null sin consultar mascotas cuando el cliente no existe', async () => {
    const findUnique = vi.fn(async () => null);
    const findMany = vi.fn();
    const repository = new ClientsRepository({ client: { findUnique }, patient: { findMany } } as never);

    await expect(repository.findPetsByClientId('missing')).resolves.toBeNull();
    expect(findMany).not.toHaveBeenCalled();
  });
});
