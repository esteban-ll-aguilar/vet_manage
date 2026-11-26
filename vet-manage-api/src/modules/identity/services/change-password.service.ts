import { Injectable } from '@nestjs/common';
import { ApiException } from '../../../common/errors/api-exception.js';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';
import { AUDIT_ACTIONS, AUDIT_MODULES } from '../../audit/audit.catalog.js';
import { describePerson } from '../../audit/describe-person.js';
import { AuditService } from '../../audit/services/audit.service.js';
import type { ChangePasswordDto } from '../dtos/change-password.dto.js';
import { PasswordHasher } from './password-hasher.service.js';

export const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export const CHANGE_PASSWORD_MESSAGES = {
  missing: 'Complete los campos obligatorios',
  wrongCurrent: 'La contraseña actual no es correcta',
  weakPassword: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número',
  mismatch: 'Las contraseñas no coinciden',
  sameAsCurrent: 'La nueva contraseña debe ser diferente a la actual',
  updated: 'Contraseña actualizada correctamente',
} as const;

@Injectable()
export class ChangePasswordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hasher: PasswordHasher,
    private readonly audit: AuditService,
  ) {}

  async changePassword(userId: string, input: ChangePasswordDto): Promise<{ message: string }> {
    const currentPassword = input.currentPassword ?? '';
    const newPassword = input.newPassword ?? '';
    const confirmPassword = input.confirmPassword ?? '';

    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      throw new ApiException(CHANGE_PASSWORD_MESSAGES.missing, 400, [], 'CHANGE_PASSWORD_MISSING_FIELDS');
    }

    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          password: true,
          status: true,
          person: { select: { identification: true, firstName: true, lastName: true } },
        },
      });

      if (!user || !user.password || user.status !== 'ACTIVE') {
        throw ApiException.unauthorized('Cuenta inexistente o inactiva');
      }

      const matchesCurrent = await this.hasher.verify(currentPassword, user.password);
      if (!matchesCurrent) {
        throw new ApiException(CHANGE_PASSWORD_MESSAGES.wrongCurrent, 400, [], 'CHANGE_PASSWORD_WRONG_CURRENT');
      }

      if (newPassword !== confirmPassword) {
        throw new ApiException(CHANGE_PASSWORD_MESSAGES.mismatch, 400, [], 'CHANGE_PASSWORD_MISMATCH');
      }

      if (!PASSWORD_POLICY.test(newPassword)) {
        throw new ApiException(CHANGE_PASSWORD_MESSAGES.weakPassword, 400, [], 'CHANGE_PASSWORD_WEAK');
      }

      if (newPassword === currentPassword || (await this.hasher.verify(newPassword, user.password))) {
        throw new ApiException(CHANGE_PASSWORD_MESSAGES.sameAsCurrent, 400, [], 'CHANGE_PASSWORD_SAME_AS_CURRENT');
      }

      const hashedPassword = await this.hasher.hash(newPassword);

      await tx.user.update({
        where: { id: userId },
        data: { password: hashedPassword, mustChangePassword: false },
      });

      await this.audit.record(tx, {
        actorId: userId,
        action: AUDIT_ACTIONS.changePassword,
        module: AUDIT_MODULES.users,
        affectedRecord: describePerson(user.person),
      });
    });

    return { message: CHANGE_PASSWORD_MESSAGES.updated };
  }
}
