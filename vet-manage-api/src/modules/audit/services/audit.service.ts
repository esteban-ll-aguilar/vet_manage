import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { AuditAction, AuditModule } from '../audit.catalog.js';

export type AuditEntry = {
  actorId: string;
  action: AuditAction;
  module: AuditModule;
  affectedRecord: string;
  previousValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
};

@Injectable()
export class AuditService {
  // Se guarda con el cliente de la transacción de la acción: si esta falla, no queda registro.
  async record(tx: Prisma.TransactionClient, entry: AuditEntry): Promise<void> {
    const now = new Date();
    const roles = await tx.role.findMany({
      where: {
        isActive: true,
        userRoles: { some: { userId: entry.actorId, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } },
      },
      select: { displayName: true },
    });

    await tx.auditLog.create({
      data: {
        userId: entry.actorId,
        role: roles.map((role) => role.displayName).sort((a, b) => a.localeCompare(b, 'es')).join(', '),
        action: entry.action,
        module: entry.module,
        affectedRecord: entry.affectedRecord,
        ...(entry.previousValue !== undefined ? { previousValue: entry.previousValue } : {}),
        ...(entry.newValue !== undefined ? { newValue: entry.newValue } : {}),
      },
    });
  }
}
