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
  const listPets = vi.fn(async (): Promise<unknown[]> => []);
  const inactivate = vi.fn(async () => ({
    message: 'Cliente inactivado correctamente',
    client: { id: 'c1', status: 'INACTIVE' as const },
  }));
  const activate = vi.fn(async () => ({
    message: 'Cliente activado correctamente',
    client: { id: 'c1', status: 'ACTIVE' as const },
  }));
  const update = vi.fn(async () => ({
    message: 'Datos actualizados correctamente',
    client: { id: 'c1', firstName: 'Carlos' },
  }));
  const service = { list, listPets };
  const deactivate = vi.fn(async () => ({
    message: 'Cliente dado de baja correctamente',
    client: { id: 'c1', status: 'DEACTIVATED' as const, deactivatedAt: '2026-11-24T15:00:00.000Z', deactivationReason: 'Se mudó' },
  }));
  const statusChange = { inactivate, activate, deactivate };
  const updateClient = { update };
  return {
    controller: new ClientsController(service as never, statusChange as never, updateClient as never),
    service,
    list,
    listPets,
    inactivate,
    activate,
    deactivate,
    update,
  };
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

  it('exige el permiso clients:inactivate al inactivar un cliente', () => {
    const method = Object.getOwnPropertyDescriptor(ClientsController.prototype, 'inactivate')?.value;
    const permissions = Reflect.getMetadata(PERMISSIONS_METADATA, method as object);

    expect(permissions).toEqual(['clients:inactivate']);
  });

  it('delega la inactivación con el usuario autenticado y devuelve la envoltura success', async () => {
    const result = await ctx.controller.inactivate('c1', { user: { id: 'u1', personId: 'p1' } } as never);

    expect(ctx.inactivate).toHaveBeenCalledWith('c1', 'u1');
    expect(result).toEqual(success({ id: 'c1', status: 'INACTIVE' }, 'Cliente inactivado correctamente'));
  });

  it('exige el permiso clients:activate al activar un cliente (HU-05)', () => {
    const method = Object.getOwnPropertyDescriptor(ClientsController.prototype, 'activate')?.value;
    const permissions = Reflect.getMetadata(PERMISSIONS_METADATA, method as object);

    expect(permissions).toEqual(['clients:activate']);
  });

  it('delega la activación con el usuario autenticado y devuelve la envoltura success', async () => {
    const result = await ctx.controller.activate('c1', { user: { id: 'u1', personId: 'p1' } } as never);

    expect(ctx.activate).toHaveBeenCalledWith('c1', 'u1');
    expect(result).toEqual(success({ id: 'c1', status: 'ACTIVE' }, 'Cliente activado correctamente'));
  });

  it('rechaza la activación sin usuario autenticado', async () => {
    await expect(ctx.controller.activate('c1', {} as never)).rejects.toMatchObject({ statusCode: 401 });
    expect(ctx.activate).not.toHaveBeenCalled();
  });

  it('exige el permiso clients:update al actualizar un cliente', () => {
    const method = Object.getOwnPropertyDescriptor(ClientsController.prototype, 'update')?.value;
    const permissions = Reflect.getMetadata(PERMISSIONS_METADATA, method as object);

    expect(permissions).toEqual(['clients:update']);
  });

  it('delega la actualización con el usuario autenticado y devuelve la envoltura success', async () => {
    const dto = { firstName: 'Carlos', phone: '0992222222' };

    const result = await ctx.controller.update('c1', dto, { user: { id: 'u1', personId: 'p1' } } as never);

    expect(ctx.update).toHaveBeenCalledWith('c1', dto, 'u1');
    expect(result).toEqual(success({ id: 'c1', firstName: 'Carlos' }, 'Datos actualizados correctamente'));
  });

  describe('deactivate (HU-03)', () => {
    it('exige el permiso clients:deactivate', () => {
      const method = Object.getOwnPropertyDescriptor(ClientsController.prototype, 'deactivate')?.value;
      expect(Reflect.getMetadata(PERMISSIONS_METADATA, method as object)).toEqual(['clients:deactivate']);
    });

    it('delega la baja con el motivo y el usuario autenticado y devuelve la envoltura success', async () => {
      const result = await ctx.controller.deactivate('c1', { reason: 'Se mudó' }, { user: { id: 'u1', personId: 'p1' } } as never);

      expect(ctx.deactivate).toHaveBeenCalledWith('c1', 'Se mudó', 'u1');
      expect(result).toEqual(success(
        { id: 'c1', status: 'DEACTIVATED', deactivatedAt: '2026-11-24T15:00:00.000Z', deactivationReason: 'Se mudó' },
        'Cliente dado de baja correctamente',
      ));
    });

    it('responde 401 si no hay usuario autenticado', async () => {
      await expect(ctx.controller.deactivate('c1', { reason: 'x' }, {} as never)).rejects.toMatchObject({ statusCode: 401 });
      expect(ctx.deactivate).not.toHaveBeenCalled();
    });
  });
});
