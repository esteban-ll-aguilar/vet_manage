import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROLE_PERMISSIONS_MESSAGES, RolePermissionsService } from './role-permissions.service.js';

const receptionist = {
  id: 'role-receptionist',
  name: 'receptionist',
  displayName: 'Recepcionista',
  category: 'STAFF',
  isActive: true,
  isVisible: true,
  rolePermissions: [
    { permission: { module: 'clients', action: 'read' } },
  ],
};

const permissions = [
  { id: 'permission-clients-create', module: 'clients', action: 'create', isActive: true, isVisible: true },
  { id: 'permission-clients-read', module: 'clients', action: 'read', isActive: true, isVisible: true },
  { id: 'permission-roles-manage', module: 'roles', action: 'manage-permissions', isActive: true, isVisible: true },
  { id: 'permission-users-create', module: 'users', action: 'create', isActive: true, isVisible: true },
  { id: 'permission-users-read', module: 'users', action: 'read', isActive: true, isVisible: true },
  { id: 'permission-users-update', module: 'users', action: 'update', isActive: true, isVisible: true },
  { id: 'permission-users-assign-roles', module: 'users', action: 'assign-roles', isActive: true, isVisible: true },
  { id: 'permission-users-change-status', module: 'users', action: 'change-status', isActive: true, isVisible: true },
  { id: 'permission-users-deactivate', module: 'users', action: 'deactivate', isActive: true, isVisible: true },
];

function build(role = receptionist) {
  const tx = {
    role: {
      findUnique: vi.fn().mockResolvedValue(role),
      update: vi.fn(),
    },
    permission: { findMany: vi.fn().mockResolvedValue(permissions) },
    rolePermission: { deleteMany: vi.fn(), createMany: vi.fn() },
  };
  const prisma = {
    role: { findMany: vi.fn().mockResolvedValue([]) },
    permission: {
      findMany: vi.fn().mockResolvedValue(permissions.map((permission) => ({
        id: permission.id,
        module: permission.module,
        action: permission.action,
        displayName: permission.action,
        description: null,
      }))),
    },
    $transaction: vi.fn(async (run: (transaction: typeof tx) => Promise<unknown>) => run(tx)),
  };
  const audit = { record: vi.fn(async () => undefined) };
  return {
    tx,
    prisma,
    audit,
    service: new RolePermissionsService(prisma as never, audit as never),
  };
}

describe('RolePermissionsService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reemplaza los permisos seleccionados de un rol y registra el cambio', async () => {
    const { service, tx, audit } = build();

    const result = await service.update(
      'role-receptionist',
      ['clients:create', 'clients:read'],
      'admin-1',
    );

    expect(result.permissionKeys).toEqual(['clients:create', 'clients:read']);
    expect(tx.rolePermission.deleteMany).toHaveBeenCalledWith({ where: { roleId: 'role-receptionist' } });
    expect(tx.rolePermission.createMany).toHaveBeenCalledWith({
      data: [
        { roleId: 'role-receptionist', permissionId: 'permission-clients-create' },
        { roleId: 'role-receptionist', permissionId: 'permission-clients-read' },
      ],
    });
    expect(tx.role.update).toHaveBeenCalledWith({
      where: { id: 'role-receptionist' },
      data: { permissionsCustomized: true },
    });
    expect(audit.record).toHaveBeenCalledWith(tx, expect.objectContaining({
      actorId: 'admin-1',
      action: 'Actualizar permisos',
      module: 'Permisos por rol',
      previousValue: ['clients:read'],
      newValue: ['clients:create', 'clients:read'],
    }));
  });

  it('mantiene cada permiso protegido del Administrador', async () => {
    const administrator = {
      ...receptionist,
      id: 'role-administrator',
      name: 'administrator',
      displayName: 'Administrador',
      rolePermissions: [
        { permission: { module: 'roles', action: 'manage-permissions' } },
        { permission: { module: 'users', action: 'create' } },
        { permission: { module: 'users', action: 'read' } },
        { permission: { module: 'users', action: 'update' } },
        { permission: { module: 'users', action: 'assign-roles' } },
        { permission: { module: 'users', action: 'change-status' } },
        { permission: { module: 'users', action: 'deactivate' } },
      ],
    };
    const { service, tx, audit } = build(administrator);

    const invalidSelections = [
      ['roles:manage-permissions', 'users:create', 'users:read', 'users:update', 'users:assign-roles', 'users:change-status'],
      ['users:create', 'users:read', 'users:update', 'users:assign-roles', 'users:change-status', 'users:deactivate'],
    ];
    for (const permissionKeys of invalidSelections) {
      await expect(service.update('role-administrator', permissionKeys, 'admin-1')).rejects.toMatchObject({
        message: ROLE_PERMISSIONS_MESSAGES.protectedAdministrator,
        statusCode: 400,
      });
    }
    expect(tx.rolePermission.deleteMany).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('rechaza permisos que no pertenecen al catálogo activo', async () => {
    const { service, tx, audit } = build();

    await expect(service.update('role-receptionist', ['unknown:execute'], 'admin-1')).rejects.toMatchObject({
      message: ROLE_PERMISSIONS_MESSAGES.invalidPermission,
      statusCode: 400,
    });
    expect(tx.rolePermission.deleteMany).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('no reescribe ni audita cuando se guardan los mismos permisos', async () => {
    const { service, tx, audit } = build();

    const result = await service.update('role-receptionist', ['clients:read'], 'admin-1');

    expect(result.permissionKeys).toEqual(['clients:read']);
    expect(tx.rolePermission.deleteMany).not.toHaveBeenCalled();
    expect(tx.role.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('excluye roles y permisos inactivos u ocultos del catálogo', async () => {
    const role = {
      ...receptionist,
      rolePermissions: [{
        permission: { module: 'clients', action: 'read', isActive: false, isVisible: true },
      }],
    };
    const { service, prisma } = build(role);
    prisma.role.findMany.mockResolvedValue([{
      ...role,
      rolePermissions: [{
        permission: { module: 'clients', action: 'read', isActive: false, isVisible: true },
      }],
    }] as never);

    const catalog = await service.getCatalog();

    expect(catalog.roles[0].permissionKeys).toEqual([]);
    expect(catalog.protectedPermissionKeys).toEqual([
      'roles:manage-permissions',
      'users:create',
      'users:read',
      'users:update',
      'users:assign-roles',
      'users:change-status',
      'users:deactivate',
    ]);
    expect(prisma.role.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { isActive: true, isVisible: true },
    }));
    expect(prisma.permission.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { isActive: true, isVisible: true },
    }));
  });
});
