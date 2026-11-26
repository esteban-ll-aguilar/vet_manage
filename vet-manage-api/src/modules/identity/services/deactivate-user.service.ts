import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client.js';
import { ApiException } from '../../../common/errors/api-exception.js';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';
import { AUDIT_ACTIONS, AUDIT_MODULES } from '../../audit/audit.catalog.js';
import { describePerson } from '../../audit/describe-person.js';
import { AuditService } from '../../audit/services/audit.service.js';
import type { DeactivateUserDto } from '../dtos/deactivate-user.dto.js';

export const DEACTIVATE_USER_MESSAGES = {
  userNotFound: 'Usuario no encontrado',
  alreadyDeactivated: 'El usuario ya fue dado de baja',
  missingReason: 'Ingrese el motivo de la baja',
  reasonTooLong: 'El motivo de la baja no puede superar 500 caracteres',
  selfDeactivation: 'No puede dar de baja su propia cuenta',
  lastAdmin: 'Debe existir al menos un Administrador activo',
  clientOnly: 'El usuario solo tiene el rol de cliente y no pertenece al personal',
  deactivated: 'Usuario dado de baja correctamente',
} as const;

const REASON_MAX = 500;

const STATUS_LABELS: Record<'ACTIVE' | 'INACTIVE', string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
};

export type DeactivatedUserResult = {
  message: string;
  user: {
    id: string;
    status: 'ACTIVE' | 'DEACTIVATED';
    deactivatedAt: Date | null;
    deactivationReason: string | null;
    roles: { name: string; displayName: string }[];
  };
};

@Injectable()
export class DeactivateUserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async deactivate(userId: string, input: DeactivateUserDto, actorId: string): Promise<DeactivatedUserResult> {
    const reason = normalizeReason(input?.reason);

    const user = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const current = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          status: true,
          person: { select: { identification: true, firstName: true, lastName: true } },
          userRoles: {
            select: {
              id: true,
              expiresAt: true,
              role: { select: { name: true, displayName: true, category: true, isActive: true } },
            },
          },
        },
      });

      if (!current) throw ApiException.notFound(DEACTIVATE_USER_MESSAGES.userNotFound);
      if (current.status === 'DEACTIVATED') {
        throw new ApiException(DEACTIVATE_USER_MESSAGES.alreadyDeactivated, 400, [], 'USER_ALREADY_DEACTIVATED');
      }
      if (current.id === actorId) {
        throw new ApiException(DEACTIVATE_USER_MESSAGES.selfDeactivation, 400, [], 'USER_SELF_DEACTIVATION');
      }

      const activeAssignments = current.userRoles.filter(
        (assignment) => assignment.role.isActive && (!assignment.expiresAt || assignment.expiresAt > now),
      );
      await this.ensureNotLastActiveAdmin(tx, current.id, current.status, activeAssignments, now);

      const hasClientRole = activeAssignments.some((assignment) => assignment.role.category === 'CLIENT');
      const staffAssignments = current.userRoles.filter((assignment) => assignment.role.category === 'STAFF');

      // Si la persona también es Cliente, conserva su acceso como Cliente y se retiran solo los roles de personal (HU-61, escenario 11).
      if (hasClientRole) {
        if (staffAssignments.length === 0) {
          throw new ApiException(DEACTIVATE_USER_MESSAGES.clientOnly, 400, [], 'USER_CLIENT_ONLY');
        }

        const previousRoles = activeAssignments
          .map((assignment) => assignment.role.displayName)
          .sort((a, b) => a.localeCompare(b, 'es'));
        const remainingClientRoles = activeAssignments
          .filter((assignment) => assignment.role.category === 'CLIENT')
          .map((assignment) => ({ name: assignment.role.name, displayName: assignment.role.displayName }))
          .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'));

        await this.audit.record(tx, {
          actorId,
          action: AUDIT_ACTIONS.deactivate,
          module: AUDIT_MODULES.users,
          affectedRecord: describePerson(current.person),
          previousValue: { status: STATUS_LABELS[current.status], roles: previousRoles },
          newValue: {
            status: STATUS_LABELS.ACTIVE,
            roles: remainingClientRoles.map((role) => role.displayName),
            reason,
          },
        });

        await tx.userRole.deleteMany({
          where: { id: { in: staffAssignments.map((assignment) => assignment.id) } },
        });
        if (current.status !== 'ACTIVE') {
          await tx.user.update({ where: { id: current.id }, data: { status: 'ACTIVE' } });
        }
        await tx.userSession.updateMany({
          where: { userId: current.id, revokedAt: null },
          data: { revokedAt: now },
        });

        return {
          id: current.id,
          status: 'ACTIVE' as const,
          deactivatedAt: null,
          deactivationReason: null,
          roles: remainingClientRoles,
        };
      }

      await this.audit.record(tx, {
        actorId,
        action: AUDIT_ACTIONS.deactivate,
        module: AUDIT_MODULES.users,
        affectedRecord: describePerson(current.person),
        previousValue: { status: STATUS_LABELS[current.status] },
        newValue: { status: 'Dado de baja', reason },
      });

      await tx.user.update({
        where: { id: current.id },
        data: { status: 'DEACTIVATED', deactivatedAt: now, deactivationReason: reason },
      });
      await tx.userSession.updateMany({
        where: { userId: current.id, revokedAt: null },
        data: { revokedAt: now },
      });

      return {
        id: current.id,
        status: 'DEACTIVATED' as const,
        deactivatedAt: now,
        deactivationReason: reason,
        roles: activeAssignments
          .map((assignment) => ({ name: assignment.role.name, displayName: assignment.role.displayName }))
          .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es')),
      };
    });

    return { message: DEACTIVATE_USER_MESSAGES.deactivated, user };
  }

  private async ensureNotLastActiveAdmin(
    tx: Prisma.TransactionClient,
    userId: string,
    status: 'ACTIVE' | 'INACTIVE',
    activeAssignments: { role: { name: string } }[],
    now: Date,
  ) {
    if (status !== 'ACTIVE') return;
    const isAdministrator = activeAssignments.some((assignment) => assignment.role.name === 'administrator');
    if (!isAdministrator) return;

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
      throw new ApiException(DEACTIVATE_USER_MESSAGES.lastAdmin, 400, [], 'USER_DEACTIVATION_LAST_ADMIN');
    }
  }
}

function normalizeReason(raw: unknown): string {
  const reason = typeof raw === 'string' ? raw.trim() : '';
  if (!reason) {
    throw new ApiException(DEACTIVATE_USER_MESSAGES.missingReason, 400, ['reason'], 'USER_DEACTIVATION_REASON_REQUIRED');
  }
  if (reason.length > REASON_MAX) {
    throw new ApiException(DEACTIVATE_USER_MESSAGES.reasonTooLong, 400, ['reason'], 'USER_DEACTIVATION_REASON_TOO_LONG');
  }
  return reason;
}
