import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client.js';

export type PasswordResetTokenRow = {
  id: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
  replacedAt: Date | null;
  user: {
    status: string;
    person: { identification: string; firstName: string; lastName: string };
  };
};

// Acceso a la tabla password_reset_tokens (HU-58); siempre con el cliente de la transacción.
@Injectable()
export class PasswordResetTokenRepository {
  // Marca como reemplazados los enlaces sin usar de la cuenta, para que solo sirva el más reciente.
  async replaceActive(tx: Prisma.TransactionClient, userId: string, now: Date) {
    await tx.passwordResetToken.updateMany({
      where: { userId, usedAt: null, replacedAt: null },
      data: { replacedAt: now },
    });
  }

  async create(tx: Prisma.TransactionClient, data: { userId: string; tokenHash: string; expiresAt: Date }) {
    await tx.passwordResetToken.create({ data });
  }

  findByHash(tx: Prisma.TransactionClient, tokenHash: string): Promise<PasswordResetTokenRow | null> {
    return tx.passwordResetToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
        replacedAt: true,
        user: {
          select: {
            status: true,
            person: { select: { identification: true, firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  // Devuelve false si otro uso del mismo enlace se adelantó.
  async markUsed(tx: Prisma.TransactionClient, id: string, now: Date): Promise<boolean> {
    const { count } = await tx.passwordResetToken.updateMany({
      where: { id, usedAt: null, replacedAt: null },
      data: { usedAt: now },
    });
    return count === 1;
  }
}
