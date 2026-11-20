import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ListClientsQueryDto } from '../dtos/list-clients-query.dto.js';
import type { ClientWithPerson } from '../repositories/clients.repository.js';
import { ClientsService } from './clients.service.js';

const clientRecord = (overrides: Partial<ClientWithPerson> = {}): ClientWithPerson => ({
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
  ...overrides,
});

function build() {
  const findClients = vi.fn(async () => ({ clients: [clientRecord()], total: 1 }));
  const repository = { findClients };
  const service = new ClientsService(repository as never);
  return { service, repository, findClients };
}

describe('ClientsService', () => {
  let ctx: ReturnType<typeof build>;

  beforeEach(() => {
    ctx = build();
  });

  it('mapea el registro completo sin exponer datos de autenticación', async () => {
    const result = await ctx.service.list({ page: 1, pageSize: 20 });

    expect(result).toEqual({
      items: [{
        id: 'c1',
        personId: 'p1',
        identification: '1710034065',
        firstName: 'María',
        lastName: 'López',
        email: 'maria@example.com',
        phone: '0991234567',
        address: 'Av. Principal 123',
        status: 'ACTIVE',
        roles: [{ name: 'client', displayName: 'Cliente' }],
        createdAt: '2026-11-19T12:00:00.000Z',
      }],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
    expect(JSON.stringify(result)).not.toContain('password');
  });

  it('dedupe y ordena los roles activos por nombre visible', async () => {
    ctx.findClients.mockResolvedValue({
      clients: [clientRecord({
        person: {
          ...clientRecord().person,
          user: {
            userRoles: [
              { role: { name: 'veterinarian', displayName: 'Veterinario' } },
              { role: { name: 'client', displayName: 'Cliente' } },
              { role: { name: 'client', displayName: 'Cliente' } },
            ],
          },
        },
      })],
      total: 1,
    });

    const { items } = await ctx.service.list({ page: 1, pageSize: 20 });

    expect(items[0].roles).toEqual([
      { name: 'client', displayName: 'Cliente' },
      { name: 'veterinarian', displayName: 'Veterinario' },
    ]);
  });

  it('usa page 1 y pageSize 20 cuando el query no trae valores', async () => {
    await ctx.service.list({} as ListClientsQueryDto);

    expect(ctx.findClients).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });

  it('calcula totalPages con techo y combina filtros con la paginación', async () => {
    ctx.findClients.mockResolvedValue({ clients: [], total: 21 });

    const result = await ctx.service.list({ page: 2, pageSize: 20, search: 'mar', status: 'INACTIVE' });

    expect(ctx.findClients).toHaveBeenCalledWith({ page: 2, pageSize: 20, search: 'mar', status: 'INACTIVE' });
    expect(result).toMatchObject({ items: [], page: 2, pageSize: 20, total: 21, totalPages: 2 });
  });

  it('devuelve totalPages 0 cuando no hay resultados', async () => {
    ctx.findClients.mockResolvedValue({ clients: [], total: 0 });

    const result = await ctx.service.list({ page: 1, pageSize: 20, search: 'nadie' });

    expect(result).toMatchObject({ items: [], total: 0, totalPages: 0 });
  });
});

describe('ClientsService.findById', () => {
  it('delega en el repositorio y devuelve null si el cliente no existe', async () => {
    const findById = vi.fn(async () => null);
    const service = new ClientsService({ findById } as never);

    await expect(service.findById('missing')).resolves.toBeNull();
    expect(findById).toHaveBeenCalledWith('missing');
  });
});

describe('ClientsService.listPets', () => {
  const pets = () => [{
    id: 'pet1',
    code: 'PAC-000001',
    name: 'Firulais',
    status: 'ACTIVE' as const,
    species: { name: 'Canino' },
    breed: { name: 'Labrador' },
  }];

  it('mapea las mascotas vinculadas con especie y raza como texto', async () => {
    const findPetsByClientId = vi.fn(async () => pets());
    const service = new ClientsService({ findPetsByClientId } as never);

    await expect(service.listPets('c1')).resolves.toEqual([{
      id: 'pet1',
      code: 'PAC-000001',
      name: 'Firulais',
      species: 'Canino',
      breed: 'Labrador',
      status: 'ACTIVE',
    }]);
    expect(findPetsByClientId).toHaveBeenCalledWith('c1');
  });

  it('devuelve una lista vacía cuando el cliente no tiene mascotas', async () => {
    const service = new ClientsService({ findPetsByClientId: vi.fn(async () => []) } as never);

    await expect(service.listPets('c1')).resolves.toEqual([]);
  });

  it('lanza 404 cuando el cliente no existe', async () => {
    const service = new ClientsService({ findPetsByClientId: vi.fn(async () => null) } as never);

    await expect(service.listPets('missing')).rejects.toMatchObject({
      message: 'Cliente no encontrado',
      statusCode: 404,
    });
  });
});
