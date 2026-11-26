import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS } from '../../../config/permissions.catalog.js';
import { ROLES } from '../../../config/roles.catalog.js';
import { RbacCatalogSynchronizer } from './rbac-catalog-synchronizer.service.js';

describe('RbacCatalogSynchronizer', () => {
  it('preserva permisos personalizados de un rol en modo strict', async () => {
    const customizedRoleName = 'cashier';
    const tx = {
      permission: {
        findMany: vi.fn().mockResolvedValue(PERMISSIONS.map(({ key }) => {
          const [module, action] = key.split(':');
          return { id: key, module, action, isActive: true };
        })),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      role: {
        findUnique: vi.fn(({ where }: { where: { name: string } }) => {
          const role = ROLES.find(({ name }) => name === where.name);
          return Promise.resolve(role && {
            id: `id:${role.name}`,
            name: role.name,
            permissionsCustomized: role.name === customizedRoleName,
          });
        }),
        create: vi.fn(),
        update: vi.fn(({ where }: { where: { id: string } }) => Promise.resolve({
          id: where.id,
          permissionsCustomized: where.id === `id:${customizedRoleName}`,
        })),
      },
      rolePermission: {
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const service = new RbacCatalogSynchronizer({} as never, {} as never);

    await service.synchronizeWith(tx as never, 'strict');

    const synchronizedRoleIds = tx.rolePermission.deleteMany.mock.calls.map(
      ([input]) => (input as { where: { roleId: string } }).where.roleId,
    );
    expect(synchronizedRoleIds).not.toContain(`id:${customizedRoleName}`);
  });
});
