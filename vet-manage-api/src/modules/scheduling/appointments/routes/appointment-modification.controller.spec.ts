import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { ApiException } from '../../../../common/errors/api-exception.js';
import { ROLES } from '../../../../config/roles.catalog.js';
import { PERMISSIONS_METADATA } from '../../../identity/decorators/require-permissions.decorator.js';
import { PermissionsGuard } from '../../../identity/guards/permissions.guard.js';
import { AppointmentModificationController } from './appointment-modification.controller.js';

const permissionsOf = (method: keyof AppointmentModificationController) =>
  Reflect.getMetadata(PERMISSIONS_METADATA, AppointmentModificationController.prototype[method]) as string[];

// Ejecuta el guard real sobre el método con los permisos de un rol del catálogo.
function canModifyAs(roleName: string) {
  const permissions = new Set<string>(ROLES.find((role) => role.name === roleName)?.permissions ?? []);
  const guard = new PermissionsGuard(new Reflector(), { getPermissionKeys: vi.fn(async () => permissions) } as never);
  const context = {
    getHandler: () => Object.getOwnPropertyDescriptor(AppointmentModificationController.prototype, 'modify')?.value as unknown,
    getClass: () => AppointmentModificationController,
    switchToHttp: () => ({ getRequest: () => ({ user: { id: 'user-1', personId: 'p-1' } }) }),
  };
  return guard.canActivate(context as never);
}

describe('AppointmentModificationController', () => {
  it('consultar y modificar una cita exige appointments:update', () => {
    expect(permissionsOf('detail')).toEqual(['appointments:update']);
    expect(permissionsOf('modify')).toEqual(['appointments:update']);
  });

  it('la recepcionista puede modificar citas', async () => {
    await expect(canModifyAs('receptionist')).resolves.toBe(true);
  });

  it('el veterinario recibe 403 "No tiene permisos para realizar esta acción"', async () => {
    const error = await canModifyAs('veterinarian').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).statusCode).toBe(403);
    expect((error as ApiException).message).toBe('No tiene permisos para realizar esta acción');
  });

  it('modifica la cita a nombre del usuario de la sesión', async () => {
    const execute = vi.fn(async () => ({ id: 'cita-1', estado: 'PROGRAMADA' }));
    const controller = new AppointmentModificationController({ execute } as never);
    const input = { fecha: '2026-11-03', horaInicio: '11:00', veterinarioId: 'vet-1', salaId: 'room-1' };

    const response = await controller.modify('cita-1', input, { user: { id: 'recep-1', personId: 'p-1' } } as never);

    expect(execute).toHaveBeenCalledWith('cita-1', input, 'recep-1');
    expect(response).toMatchObject({ message: 'Cita modificada correctamente' });
  });

  it('rechaza la petición sin usuario autenticado', async () => {
    const controller = new AppointmentModificationController({ execute: vi.fn() } as never);
    await expect(controller.modify('cita-1', {} as never, {} as never)).rejects.toBeInstanceOf(ApiException);
  });
});
