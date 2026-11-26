import { Injectable } from '@nestjs/common';
import { ApiException } from '../../../common/errors/api-exception.js';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';
import { AUDIT_ACTIONS, AUDIT_MODULES } from '../../audit/audit.catalog.js';
import { describePerson } from '../../audit/describe-person.js';
import { AuditService } from '../../audit/services/audit.service.js';

export const ROLE_ASSIGNMENT_MESSAGES = {
  userNotFound: 'Usuario no encontrado',
  deactivated: 'No se pueden modificar los roles de un usuario dado de baja',
  atLeastOne: 'El usuario debe tener al menos un rol',
  lastAdmin: 'Debe existir al menos un Administrador activo',
  invalidRoles: 'Seleccione roles válidos del personal',
} as const;

export type RoleRef = { name: string; displayName: string };

export type RoleAssignmentView = {
  user: { id: string; status: string; fullName: string };
  currentRoles: RoleRef[];
  availableRoles: RoleRef[];
};

@Injectable()
export class UserRoleAssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(userId: string): Promise<RoleAssignmentView> {
    const now = new Date();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
        person: { select: { firstName: true, lastName: true } },
        userRoles: {
          where: { role: { isActive: true }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          select: { role: { select: { name: true, displayName: true } } },
        },
      },
    });
    if (!user) throw ApiException.notFound(ROLE_ASSIGNMENT_MESSAGES.userNotFound);

    const currentRoles = user.userRoles
      .map((assignment) => assignment.role)
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'));
    const currentNames = currentRoles.map((role) => role.name);

    const availableRoles = await this.prisma.role.findMany({
      where: { isActive: true, category: 'STAFF', ...(currentNames.length > 0 ? { name: { notIn: currentNames } } : {}) },
      select: { name: true, displayName: true },
      orderBy: { displayName: 'asc' },
    });

    return {
      user: {
        id: user.id,
        status: user.status,
        fullName: `${user.person.firstName} ${user.person.lastName}`.trim(),
      },
      currentRoles,
      availableRoles,
    };
  }

  async update(userId: string, inputRoles: string[] | undefined, actorId: string): Promise<RoleAssignmentView> {
    const finalNames = normalizeRoles(inputRoles);
    if (finalNames.length === 0) {
      throw new ApiException(ROLE_ASSIGNMENT_MESSAGES.atLeastOne, 400, [], 'USER_ROLE_AT_LEAST_ONE');
    }

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          status: true,
          person: { select: { identification: true, firstName: true, lastName: true } },
          userRoles: {
            select: {
              id: true,
              roleId: true,
              expiresAt: true,
              role: { select: { name: true, displayName: true, isActive: true } },
            },
          },
        },
      });
      if (!user) throw ApiException.notFound(ROLE_ASSIGNMENT_MESSAGES.userNotFound);
      if (user.status === 'DEACTIVATED') {
        throw new ApiException(ROLE_ASSIGNMENT_MESSAGES.deactivated, 400, [], 'USER_ROLE_DEACTIVATED');
      }

      const desiredRoles = await tx.role.findMany({
        where: { name: { in: finalNames }, isActive: true, category: 'STAFF' },
        select: { id: true, name: true, displayName: true },
      });
      if (desiredRoles.length !== finalNames.length) {
        throw new ApiException(ROLE_ASSIGNMENT_MESSAGES.invalidRoles, 400, [], 'USER_INVALID_ROLES');
      }

      const effectiveNow = user.userRoles.filter(
        (assignment) => assignment.role.isActive && (!assignment.expiresAt || assignment.expiresAt > now),
      );
      const effectiveNames = new Set(effectiveNow.map((assignment) => assignment.role.name));

      if (effectiveNames.has('administrator') && !finalNames.includes('administrator')) {
        const otherAdmins = await tx.user.count({
          where: {
            id: { not: userId },
            status: 'ACTIVE',
            userRoles: {
              some: {
                role: { name: 'administrator', isActive: true },
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
              },
            },
          },
        });
        if (otherAdmins === 0) {
          throw new ApiException(ROLE_ASSIGNMENT_MESSAGES.lastAdmin, 400, [], 'USER_ROLE_LAST_ADMIN');
        }
      }

      const desiredIds = new Set(desiredRoles.map((role) => role.id));
      const byRoleId = new Map(user.userRoles.map((assignment) => [assignment.roleId, assignment]));

      const toAdd = desiredRoles.filter((role) => !byRoleId.has(role.id));
      const toRenew = desiredRoles.flatMap((role) => {
        const assignment = byRoleId.get(role.id);
        return assignment?.expiresAt && assignment.expiresAt <= now ? [assignment.id] : [];
      });
      const toRemove = user.userRoles
        .filter((assignment) => !desiredIds.has(assignment.roleId))
        .map((assignment) => assignment.id);

      // Se registra antes de aplicar los cambios para que el rol guardado sea el que tenía el actor.
      if (toAdd.length > 0 || toRenew.length > 0 || toRemove.length > 0) {
        const previousValue = effectiveNow
          .map((assignment) => assignment.role.displayName)
          .sort((a, b) => a.localeCompare(b, 'es'));
        const newValue = desiredRoles
          .map((role) => role.displayName)
          .sort((a, b) => a.localeCompare(b, 'es'));

        await this.audit.record(tx, {
          actorId,
          action: AUDIT_ACTIONS.assignRoles,
          module: AUDIT_MODULES.users,
          affectedRecord: describePerson(user.person),
          previousValue,
          newValue,
        });
      }

      for (const role of toAdd) {
        await tx.userRole.create({ data: { userId, roleId: role.id, assignedById: actorId } });
      }
      for (const id of toRenew) {
        await tx.userRole.update({ where: { id }, data: { expiresAt: null, assignedById: actorId } });
      }
      if (toRemove.length > 0) {
        await tx.userRole.deleteMany({ where: { id: { in: toRemove } } });
      }
    });

    return this.get(userId);
  }
}

function normalizeRoles(roles: string[] | undefined): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of roles ?? []) {
    const name = raw.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    result.push(name);
  }
  return result;
}
