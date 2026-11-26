import { Injectable } from '@nestjs/common';
import { ApiException } from '../../../common/errors/api-exception.js';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';
import { AUDIT_ACTIONS, AUDIT_MODULES } from '../../audit/audit.catalog.js';
import { AuditService } from '../../audit/services/audit.service.js';

export const ROLE_PERMISSIONS_MESSAGES = {
  notFound: 'Rol no encontrado',
  invalidPermission: 'La selección contiene permisos no válidos',
  protectedAdministrator: 'No se puede retirar este permiso al rol Administrador',
  updated: 'Permisos del rol actualizados correctamente',
} as const;

export const ADMINISTRATOR_REQUIRED_PERMISSION_KEYS = [
  'roles:manage-permissions',
  'users:create',
  'users:read',
  'users:update',
  'users:assign-roles',
  'users:change-status',
  'users:deactivate',
] as const;

const ADMINISTRATOR_ROLE_NAME = 'administrator';

export type ManagedPermission = {
  key: string;
  module: string;
  action: string;
  displayName: string;
  description: string | null;
};

export type ManagedRole = {
  id: string;
  name: string;
  displayName: string;
  category: string;
  permissionKeys: string[];
};

export type RolePermissionsCatalog = {
  roles: ManagedRole[];
  permissions: ManagedPermission[];
  protectedPermissionKeys: readonly string[];
};

@Injectable()
export class RolePermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getCatalog(): Promise<RolePermissionsCatalog> {
    const [roles, permissions] = await Promise.all([
      this.prisma.role.findMany({
        where: { isActive: true, isVisible: true },
        select: {
          id: true,
          name: true,
          displayName: true,
          category: true,
          rolePermissions: {
            select: { permission: { select: { module: true, action: true, isActive: true, isVisible: true } } },
          },
        },
        orderBy: { displayName: 'asc' },
      }),
      this.prisma.permission.findMany({
        where: { isActive: true, isVisible: true },
        select: { module: true, action: true, displayName: true, description: true },
        orderBy: [{ module: 'asc' }, { displayName: 'asc' }],
      }),
    ]);

    return {
      roles: roles.map((role) => ({
        id: role.id,
        name: role.name,
        displayName: role.displayName,
        category: role.category,
        permissionKeys: role.rolePermissions
          .filter(({ permission }) => permission.isActive && permission.isVisible)
          .map(({ permission }) => `${permission.module}:${permission.action}`)
          .sort(),
      })),
      permissions: permissions.map((permission) => ({
        key: `${permission.module}:${permission.action}`,
        module: permission.module,
        action: permission.action,
        displayName: permission.displayName,
        description: permission.description,
      })),
      protectedPermissionKeys: ADMINISTRATOR_REQUIRED_PERMISSION_KEYS,
    };
  }

  async update(roleId: string, inputKeys: string[], actorId: string): Promise<ManagedRole> {
    const permissionKeys = normalizePermissionKeys(inputKeys);

    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.findUnique({
        where: { id: roleId },
        select: {
          id: true,
          name: true,
          displayName: true,
          category: true,
          isActive: true,
          isVisible: true,
          rolePermissions: {
            select: { permission: { select: { module: true, action: true } } },
          },
        },
      });
      if (!role || !role.isActive || !role.isVisible) {
        throw ApiException.notFound(ROLE_PERMISSIONS_MESSAGES.notFound);
      }

      const availablePermissions = await tx.permission.findMany({
        where: { isActive: true, isVisible: true },
        select: { id: true, module: true, action: true },
      });
      const permissionIdsByKey = new Map(
        availablePermissions.map((permission) => [`${permission.module}:${permission.action}`, permission.id]),
      );
      if (permissionKeys.some((key) => !permissionIdsByKey.has(key))) {
        throw new ApiException(ROLE_PERMISSIONS_MESSAGES.invalidPermission, 400, [], 'ROLE_INVALID_PERMISSION');
      }

      if (
        role.name === ADMINISTRATOR_ROLE_NAME
        && ADMINISTRATOR_REQUIRED_PERMISSION_KEYS.some((key) => !permissionKeys.includes(key))
      ) {
        throw new ApiException(
          ROLE_PERMISSIONS_MESSAGES.protectedAdministrator,
          400,
          [],
          'ROLE_ADMIN_PERMISSION_PROTECTED',
        );
      }

      const previousKeys = role.rolePermissions
        .map(({ permission }) => `${permission.module}:${permission.action}`)
        .sort();
      const nextKeys = [...permissionKeys].sort();
      if (!sameValues(previousKeys, nextKeys)) {
        await this.audit.record(tx, {
          actorId,
          action: AUDIT_ACTIONS.managePermissions,
          module: AUDIT_MODULES.roles,
          affectedRecord: role.displayName,
          previousValue: previousKeys,
          newValue: nextKeys,
        });

        await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
        if (nextKeys.length > 0) {
          const assignments = nextKeys.map((key) => {
            const permissionId = permissionIdsByKey.get(key);
            if (!permissionId) {
              throw new ApiException(ROLE_PERMISSIONS_MESSAGES.invalidPermission, 400, [], 'ROLE_INVALID_PERMISSION');
            }
            return { roleId: role.id, permissionId };
          });
          await tx.rolePermission.createMany({
            data: assignments,
          });
        }
        await tx.role.update({ where: { id: role.id }, data: { permissionsCustomized: true } });
      }

      return {
        id: role.id,
        name: role.name,
        displayName: role.displayName,
        category: role.category,
        permissionKeys: nextKeys,
      };
    });
  }
}

function normalizePermissionKeys(keys: string[]): string[] {
  return [...new Set(keys.map((key) => key.trim()).filter(Boolean))].sort();
}

function sameValues(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
