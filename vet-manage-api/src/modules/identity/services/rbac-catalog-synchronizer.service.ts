import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PERMISSIONS } from '../../../config/permissions.catalog.js';
import { ROLES } from '../../../config/roles.catalog.js';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';

@Injectable()
export class RbacCatalogSynchronizer implements OnModuleInit {
  private readonly logger = new Logger(RbacCatalogSynchronizer.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;

    const result = await this.synchronize();
    this.logger.log(
      `RBAC sincronizado: ${result.permissionsCreated} permisos creados, `
      + `${result.permissionsUpdated} actualizados, ${result.permissionsDeactivated} desactivados; `
      + `${result.rolesCreated} roles creados, ${result.grantsCreated} grants agregados, `
      + `${result.grantsRevoked} grants revocados`,
    );
  }

  async synchronize() {
    return this.prisma.$transaction(async (tx) => {
      const existingPermissions = await tx.permission.findMany();
      let permissionsCreated = 0;
      let permissionsUpdated = 0;

      for (const definition of PERMISSIONS) {
        const [module, action] = definition.key.split(':', 2);
        const existing = existingPermissions.find(
          (permission) => permission.module === module && permission.action === action,
        );
        const data = {
          module,
          action,
          displayName: definition.displayName,
          description: definition.description,
          isVisible: definition.visible ?? true,
          isActive: true,
        };

        if (!existing) {
          await tx.permission.create({ data });
          permissionsCreated++;
        } else if (
          existing.displayName !== data.displayName
          || existing.description !== data.description
          || existing.isVisible !== data.isVisible
          || !existing.isActive
        ) {
          await tx.permission.update({ where: { id: existing.id }, data });
          permissionsUpdated++;
        }
      }

      const declaredKeys = new Set(PERMISSIONS.map((permission) => permission.key));
      const currentPermissions = await tx.permission.findMany({ where: { isActive: true } });
      const undeclaredPermissionIds = currentPermissions
        .filter((permission) => !declaredKeys.has(`${permission.module}:${permission.action}`))
        .map((permission) => permission.id);
      const permissionsDeactivated = undeclaredPermissionIds.length > 0
        ? await tx.permission.updateMany({
          where: { id: { in: undeclaredPermissionIds } },
          data: { isActive: false },
        })
        : { count: 0 };

      const activePermissions = await tx.permission.findMany({ where: { isActive: true } });
      const permissionIds = new Map(activePermissions.map((permission) => [
        `${permission.module}:${permission.action}`,
        permission.id,
      ]));
      let rolesCreated = 0;
      let grantsCreated = 0;
      let grantsRevoked = 0;

      for (const definition of ROLES) {
        const existing = await tx.role.findUnique({ where: { name: definition.name } });
        const role = existing
          ? await tx.role.update({
            where: { id: existing.id },
            data: {
              displayName: definition.displayName,
              description: definition.description,
              category: definition.category,
              isSystem: true,
              isVisible: definition.visible ?? true,
              isActive: true,
            },
          })
          : await tx.role.create({
            data: {
              name: definition.name,
              displayName: definition.displayName,
              description: definition.description,
              category: definition.category,
              isSystem: true,
              isVisible: definition.visible ?? true,
              isActive: true,
            },
          });

        if (!existing) rolesCreated++;

        const desiredPermissionIds = new Set(
          (definition.allPermissions ? activePermissions.map((permission) => permission.id) : definition.permissions
            .map((key) => permissionIds.get(key))
            .filter((id): id is string => Boolean(id))),
        );
        const currentGrants = await tx.rolePermission.findMany({ where: { roleId: role.id } });
        const revoked = currentGrants.filter((grant) => !desiredPermissionIds.has(grant.permissionId));
        if (revoked.length > 0) {
          await tx.rolePermission.deleteMany({
            where: { roleId: role.id, permissionId: { in: revoked.map((grant) => grant.permissionId) } },
          });
          grantsRevoked += revoked.length;
        }

        const currentIds = new Set(currentGrants.map((grant) => grant.permissionId));
        const missing = [...desiredPermissionIds].filter((permissionId) => !currentIds.has(permissionId));
        if (missing.length > 0) {
          await tx.rolePermission.createMany({
            data: missing.map((permissionId) => ({ roleId: role.id, permissionId })),
            skipDuplicates: true,
          });
          grantsCreated += missing.length;
        }
      }

      const declaredRoleNames = ROLES.map((role) => role.name);
      await tx.role.updateMany({
        where: { isSystem: true, isActive: true, name: { notIn: declaredRoleNames } },
        data: { isActive: false },
      });

      return {
        permissionsCreated,
        permissionsUpdated,
        permissionsDeactivated: permissionsDeactivated.count,
        rolesCreated,
        grantsCreated,
        grantsRevoked,
      };
    });
  }
}
