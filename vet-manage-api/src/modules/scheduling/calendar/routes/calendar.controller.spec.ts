import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { validate } from 'class-validator';
import { CalendarController } from './calendar.controller.js';
import { CalendarQueryDto } from '../dtos/calendar-query.dto.js';
import { PERMISSIONS_METADATA } from '../../../identity/decorators/require-permissions.decorator.js';
import { PermissionsGuard } from '../../../identity/guards/permissions.guard.js';
import { JwtAuthGuard } from '../../../identity/guards/jwt-auth.guard.js';
import { ROLES } from '../../../../config/roles.catalog.js';

function context(user?: object) {
  return {
    getHandler: () =>
      Object.getOwnPropertyDescriptor(CalendarController.prototype, 'read')
        ?.value as object,
    getClass: () => CalendarController,
    switchToHttp: () => ({ getRequest: () => ({ user, headers: {} }) }),
  } as unknown as ExecutionContext;
}
describe('HU-001 autorización y DTO', () => {
  it('todos los endpoints heredan guardas y calendar:read', () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_METADATA, CalendarController),
    ).toEqual(['calendar:read']);
    expect(Reflect.getMetadata('__guards__', CalendarController)).toEqual([
      JwtAuthGuard,
      PermissionsGuard,
    ]);
    expect(
      ROLES.filter((r) => r.permissions.includes('calendar:read')).map(
        (r) => r.name,
      ),
    ).toEqual(['superadmin', 'receptionist']);
  });
  it('sin sesión 401, sin permiso 403 y recepcionista autorizada', async () => {
    const access = { getPermissionKeys: vi.fn().mockResolvedValue(new Set()) };
    const guard = new PermissionsGuard(new Reflector(), access as never);
    await expect(
      new JwtAuthGuard({} as never, {} as never).canActivate(context()),
    ).rejects.toMatchObject({ statusCode: 401 });
    await expect(
      guard.canActivate(context({ id: 'u1' })),
    ).rejects.toMatchObject({ statusCode: 403 });
    access.getPermissionKeys.mockResolvedValue(new Set(['calendar:read']));
    expect(await guard.canActivate(context({ id: 'u1' }))).toBe(true);
  });
  it('rechaza sucursal, formato de fecha y vista inválidos', async () => {
    expect(
      await validate(
        Object.assign(new CalendarQueryDto(), {
          sucursalId: 'loja',
          fecha: '02/11/2026',
          vista: 'anual',
        }),
      ),
    ).toHaveLength(3);
    expect(
      await validate(
        Object.assign(new CalendarQueryDto(), {
          sucursalId: '11111111-1111-4111-8111-111111111111',
          fecha: '2026-11-02',
          vista: 'dia',
        }),
      ),
    ).toEqual([]);
  });
});
