import { Injectable } from '@nestjs/common';
import { ApiException } from '../../../common/errors/api-exception.js';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';
import { AUDIT_ACTIONS, AUDIT_MODULES } from '../../audit/audit.catalog.js';
import { describePerson } from '../../audit/describe-person.js';
import { AuditService } from '../../audit/services/audit.service.js';
import type { ChangeableUserStatus } from '../dtos/change-user-status.dto.js';

export const USER_STATUS_MESSAGES = {
  userNotFound: 'Usuario no encontrado',
  deactivated: 'No se puede cambiar el estado de un usuario dado de baja',
  selfInactivation: 'No puede inactivar su propia cuenta',
  lastAdmin: 'Debe existir al menos un Administrador activo',
  inactivated: 'Cuenta inactivada correctamente',
  activated: 'Cuenta activada correctamente',
} as const;

const STATUS_LABELS: Record<ChangeableUserStatus, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
};

export type ChangedUserStatusResult = {
  message: string;
  user: {
    id: string;
    status: ChangeableUserStatus;
  };
};

@Injectable()
export class ChangeUserStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async changeStatus(
    userId: string,
    targetStatus: ChangeableUserStatus,
    actorId: string,
  ): Promise<ChangedUserStatusResult> {
    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          status: true,
          person: { select: { identification: true, firstName: true, lastName: true } },
          userRoles: {
            where: {
              role: { isActive: true },
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
            select: { role: { select: { name: true } } },
          },
        },
      });

      if (!user) throw ApiException.notFound(USER_STATUS_MESSAGES.userNotFound);
      if (user.status === 'DEACTIVATED') {
        throw new ApiException(USER_STATUS_MESSAGES.deactivated, 400, [], 'USER_STATUS_DEACTIVATED');
      }
      if (targetStatus === 'INACTIVE' && user.id === actorId) {
        throw new ApiException(USER_STATUS_MESSAGES.selfInactivation, 400, [], 'USER_STATUS_SELF_INACTIVATION');
      }

      if (targetStatus === 'INACTIVE' && user.status === 'ACTIVE') {
        const isAdministrator = user.userRoles.some((assignment) => assignment.role.name === 'administrator');
        if (isAdministrator) {
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
            throw new ApiException(USER_STATUS_MESSAGES.lastAdmin, 400, [], 'USER_STATUS_LAST_ADMIN');
          }
        }
      }

      if (user.status === targetStatus) return;

      const previousStatus = user.status;
      await tx.user.update({
        where: { id: userId },
        data: { status: targetStatus },
      });

      if (targetStatus === 'INACTIVE') {
        await tx.userSession.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: now },
        });
      }

      await this.audit.record(tx, {
        actorId,
        action: targetStatus === 'INACTIVE' ? AUDIT_ACTIONS.inactivate : AUDIT_ACTIONS.activate,
        module: AUDIT_MODULES.users,
        affectedRecord: describePerson(user.person),
        previousValue: { status: STATUS_LABELS[previousStatus] },
        newValue: { status: STATUS_LABELS[targetStatus] },
      });
    });

    return {
      message: targetStatus === 'INACTIVE' ? USER_STATUS_MESSAGES.inactivated : USER_STATUS_MESSAGES.activated,
      user: { id: userId, status: targetStatus },
    };
  }
}
