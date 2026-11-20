import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { success } from '../../../common/errors/api-response.js';
import { PERMISSIONS_METADATA } from '../../identity/decorators/require-permissions.decorator.js';
import { ClientsController } from './clients.controller.js';

function build() {
  const list = vi.fn(async () => ({
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  }));
  const listPets = vi.fn(async () => []);
  const service = { list, listPets };
  return { controller: new ClientsController(service as never), service, list, listPets };
}

describe('ClientsController', () => {
  let ctx: ReturnType<typeof build>;

  beforeEach(() => {
    ctx = build();
  });

  it('exige el permiso clients:read en el listado', () => {
    const listMethod = Object.getOwnPropertyDescriptor(ClientsController.prototype, 'list')?.value;
    const permissions = Reflect.getMetadata(PERMISSIONS_METADATA, listMethod as object);

    expect(permissions).toEqual(['clients:read']);
  });

  it('delega los parámetros de query y devuelve la envoltura success', async () => {
    const query = { page: 2, pageSize: 10, search: 'mar', status: 'ACTIVE' as const };

    const result = await ctx.controller.list(query);

    expect(ctx.list).toHaveBeenCalledWith(query);
    expect(result).toEqual(success({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    }));
  });

  it('exige el permiso pets:read en la consulta de mascotas vinculadas', () => {
    const listPetsMethod = Object.getOwnPropertyDescriptor(ClientsController.prototype, 'listPets')?.value;
    const permissions = Reflect.getMetadata(PERMISSIONS_METADATA, listPetsMethod as object);

    expect(permissions).toEqual(['pets:read']);
  });

  it('devuelve las mascotas del cliente en la envoltura success', async () => {
    const pets = [{ id: 'pet1', code: 'PAC-000001', name: 'Firulais', species: 'Canino', breed: 'Labrador', status: 'ACTIVE' as const }];
    ctx.listPets.mockResolvedValue(pets);

    const result = await ctx.controller.listPets('c1');

    expect(ctx.listPets).toHaveBeenCalledWith('c1');
    expect(result).toEqual(success(pets));
  });
});
