import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { ApiException } from '../../../../common/errors/api-exception.js';
import { ROLES } from '../../../../config/roles.catalog.js';
import { PERMISSIONS_METADATA } from '../../../identity/decorators/require-permissions.decorator.js';
import { PermissionsGuard } from '../../../identity/guards/permissions.guard.js';
import { ScheduleBlocksController } from './schedule-blocks.controller.js';

const permissionsOf = (method: keyof ScheduleBlocksController) =>
  Reflect.getMetadata(PERMISSIONS_METADATA, ScheduleBlocksController.prototype[method]) as string[];

// Ejecuta el guard real sobre un método del controller con los permisos de un rol del catálogo.
function canRunAs(method: 'register' | 'remove', roleName: string) {
  const permissions = new Set<string>(ROLES.find((role) => role.name === roleName)?.permissions ?? []);
  const guard = new PermissionsGuard(new Reflector(), { getPermissionKeys: vi.fn(async () => permissions) } as never);
  const context = {
    // El guard solo lee los metadatos del método; no lo ejecuta.
    getHandler: () => Object.getOwnPropertyDescriptor(ScheduleBlocksController.prototype, method)?.value as unknown,
    getClass: () => ScheduleBlocksController,
    switchToHttp: () => ({ getRequest: () => ({ user: { id: 'user-1', personId: 'p-1' } }) }),
  };
  return guard.canActivate(context as never);
}

async function expectForbidden(promise: Promise<unknown>) {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(ApiException);
  expect((error as ApiException).statusCode).toBe(403);
  expect((error as ApiException).message).toBe('No tiene permisos para realizar esta acción');
}

describe('Registrar un bloqueo sin permiso', () => {
  it('la recepcionista recibe 403 con "No tiene permisos para realizar esta acción"', async () => {
    await expectForbidden(canRunAs('register', 'receptionist'));
  });

  it('el veterinario tampoco puede registrar bloqueos', async () => {
    await expect(canRunAs('register', 'veterinarian')).rejects.toBeInstanceOf(ApiException);
  });

  it('el gerente y el administrador sí pueden', async () => {
    await expect(canRunAs('register', 'manager')).resolves.toBe(true);
    await expect(canRunAs('register', 'administrator')).resolves.toBe(true);
  });
});

describe('Eliminar un bloqueo sin permiso', () => {
  it('el veterinario recibe 403 con "No tiene permisos para realizar esta acción"', async () => {
    await expectForbidden(canRunAs('remove', 'veterinarian'));
  });

  it('la recepcionista tampoco puede eliminar bloqueos', async () => {
    await expectForbidden(canRunAs('remove', 'receptionist'));
  });

  it('el gerente y el administrador sí pueden', async () => {
    await expect(canRunAs('remove', 'manager')).resolves.toBe(true);
    await expect(canRunAs('remove', 'administrator')).resolves.toBe(true);
  });
});

describe('ScheduleBlocksController', () => {
  it('solo registra bloqueos con el permiso schedule-blocks:create', () => {
    expect(permissionsOf('register')).toEqual(['schedule-blocks:create']);
  });

  it('consultar bloqueos y veterinarios exige schedule-blocks:read', () => {
    expect(permissionsOf('list')).toEqual(['schedule-blocks:read']);
    expect(permissionsOf('veterinarians')).toEqual(['schedule-blocks:read']);
  });

  it('solo elimina bloqueos con el permiso schedule-blocks:remove', () => {
    expect(permissionsOf('remove')).toEqual(['schedule-blocks:remove']);
  });

  it('elimina el bloqueo a nombre del usuario de la sesión', async () => {
    const execute = vi.fn(async () => ({ id: 'block-1', fechaEliminacion: '2026-11-02T15:00:00.000Z' }));
    const controller = new ScheduleBlocksController({} as never, {} as never, { execute } as never);

    const response = await controller.remove('block-1', { user: { id: 'admin-1', personId: 'p-1' } } as never);

    expect(execute).toHaveBeenCalledWith('block-1', 'admin-1');
    expect(response).toMatchObject({ statusCode: 200, data: { id: 'block-1' }, message: 'Bloqueo eliminado correctamente' });
  });

  it('registra el bloqueo a nombre del usuario de la sesión', async () => {
    const execute = vi.fn(async () => ({ id: 'block-1' }));
    const controller = new ScheduleBlocksController({ execute } as never, {} as never, {} as never);

    const response = await controller.register({ motivo: 'Mantenimiento' }, { user: { id: 'admin-1', personId: 'p-1' } } as never);

    expect(execute).toHaveBeenCalledWith({ motivo: 'Mantenimiento' }, 'admin-1');
    expect(response).toMatchObject({ statusCode: 201, data: { id: 'block-1' }, message: 'Bloqueo registrado correctamente' });
  });

  it('sin usuario en la sesión responde 401', async () => {
    const controller = new ScheduleBlocksController({ execute: vi.fn() } as never, {} as never, {} as never);

    await expect(controller.register({}, {} as never)).rejects.toBeInstanceOf(ApiException);
  });
});
