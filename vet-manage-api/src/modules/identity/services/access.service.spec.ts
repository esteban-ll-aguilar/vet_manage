import { describe, expect, it, vi } from 'vitest';
import { AccessService } from './access.service.js';

describe('AccessService.getPermissionKeys', () => {
  it('suma permisos de todos los roles activos del usuario', async () => {
    const permissionFindMany = vi.fn().mockResolvedValue([
      { module: 'clients', action: 'create' },
      { module: 'medical-history', action: 'read' },
    ]);
    const service = new AccessService({
      permission: { findMany: permissionFindMany },
    } as never);

    const permissions = await service.getPermissionKeys('user-with-multiple-roles');

    expect(permissions).toEqual(new Set(['clients:create', 'medical-history:read']));
    expect(permissionFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        rolePermissions: expect.objectContaining({
          some: expect.objectContaining({
            role: expect.objectContaining({
              userRoles: expect.objectContaining({
                some: expect.objectContaining({ userId: 'user-with-multiple-roles' }),
              }),
            }),
          }),
        }),
      }),
    }));
  });

  it('consulta los permisos nuevamente para aplicar cambios guardados a la siguiente sesión', async () => {
    const permissionFindMany = vi.fn()
      .mockResolvedValueOnce([{ module: 'clients', action: 'create' }])
      .mockResolvedValueOnce([]);
    const service = new AccessService({
      permission: { findMany: permissionFindMany },
    } as never);

    expect(await service.getPermissionKeys('user-1')).toEqual(new Set(['clients:create']));
    expect(await service.getPermissionKeys('user-1')).toEqual(new Set());
    expect(permissionFindMany).toHaveBeenCalledTimes(2);
  });
});
