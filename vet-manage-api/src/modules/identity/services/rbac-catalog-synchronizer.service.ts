import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PERMISSIONS } from '../../../config/permissions.catalog.js';
import { ROLES } from '../../../config/roles.catalog.js';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';

export type RbacSyncResult = {
  permissionsCreated: number;
  permissionsReactivated: number;
  permissionsDeactivated: number;
  rolesCreated: number;
  grantsCreated: number;
  grantsRevoked: number;
};

// create-only: solo crea lo que falta. strict: el catálogo manda y repone roles y asignaciones.
export type RbacSyncMode = 'create-only' | 'strict';

@Injectable()
export class RbacCatalogSynchronizer {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  get mode(): RbacSyncMode {
    return this.config.get<RbacSyncMode>('rbac.syncMode') ?? 'create-only';
  }

  synchronize(): Promise<RbacSyncResult> {
    return this.prisma.$transaction((tx) => this.synchronizeWith(tx, this.mode));
  }

  // En create-only no modifica ni revoca lo que ya existe en la base.
  async synchronizeWith(tx: Prisma.TransactionClient, mode: RbacSyncMode = 'create-only'): Promise<RbacSyncResult> {
    const strict = mode === 'strict';
    const existing = await tx.permission.findMany();
    const permissionIds = new Map(existing.map((p) => [`${p.module}:${p.action}`, p.id]));
    const newPermissionKeys = new Set<string>();
    let permissionsReactivated = 0;

    for (const definition of PERMISSIONS) {
      const [module, action] = definition.key.split(':', 2);
      const current = existing.find((p) => p.module === module && p.action === action);

      if (!current) {
        const created = await tx.permission.create({
          data: {
            module,
            action,
            displayName: definition.displayName,
            description: definition.description,
            isVisible: definition.visible ?? true,
          },
        });
        permissionIds.set(definition.key, created.id);
        newPermissionKeys.add(definition.key);
      } else if (!current.isActive) {
        await tx.permission.update({ where: { id: current.id }, data: { isActive: true } });
        permissionsReactivated++;
      }
    }

    const declaredKeys = new Set<string>(PERMISSIONS.map((p) => p.key));
    const retiredIds = existing
      .filter((p) => p.isActive && !declaredKeys.has(`${p.module}:${p.action}`))
      .map((p) => p.id);
    if (retiredIds.length > 0) {
      await tx.permission.updateMany({ where: { id: { in: retiredIds } }, data: { isActive: false } });
    }

    let rolesCreated = 0;
    let grantsCreated = 0;
    let grantsRevoked = 0;

    for (const definition of ROLES) {
      let role = await tx.role.findUnique({ where: { name: definition.name } });
      const isNewRole = !role;

      if (!role) {
        role = await tx.role.create({
          data: {
            name: definition.name,
            displayName: definition.displayName,
            description: definition.description,
            category: definition.category,
            isSystem: true,
            isVisible: definition.visible ?? true,
          },
        });
        rolesCreated++;
      } else if (strict) {
        role = await tx.role.update({
          where: { id: role.id },
          data: {
            displayName: definition.displayName,
            description: definition.description,
            category: definition.category,
            isSystem: true,
            isVisible: definition.visible ?? true,
            isActive: true,
          },
        });
      }

      // Strict repone el catálogo solo mientras el rol no tenga permisos editados desde la aplicación.
      const restoreCatalogPermissions = strict && !isNewRole && !role.permissionsCustomized;
      const keysToGrant = isNewRole || restoreCatalogPermissions
        ? definition.permissions
        : definition.permissions.filter((key) => newPermissionKeys.has(key));
      const desiredIds = new Set(
        keysToGrant.map((key) => permissionIds.get(key)).filter((id): id is string => Boolean(id)),
      );

      if (restoreCatalogPermissions) {
        const revoked = await tx.rolePermission.deleteMany({
          where: { roleId: role.id, permissionId: { notIn: [...desiredIds] } },
        });
        grantsRevoked += revoked.count;
      }

      const data = [...desiredIds].map((permissionId) => ({ roleId: role.id, permissionId }));
      if (data.length > 0) {
        const result = await tx.rolePermission.createMany({ data, skipDuplicates: true });
        grantsCreated += result.count;
      }
    }

    return {
      permissionsCreated: newPermissionKeys.size,
      permissionsReactivated,
      permissionsDeactivated: retiredIds.length,
      rolesCreated,
      grantsCreated,
      grantsRevoked,
    };
  }
}
