import { Prisma } from '../../src/generated/prisma/client.js';

export type Tx = Prisma.TransactionClient;

class Rollback extends Error {}

// Ejecuta el caso dentro de una transacción que siempre se revierte.
export async function inRollback(
  prisma: { $transaction: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T> },
  run: (tx: Tx) => Promise<void>,
) {
  try {
    await prisma.$transaction(async (tx) => {
      await run(tx);
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
}

// Deja la tabla de permisos y roles vacía dentro de la transacción del caso.
export async function clearRbac(tx: Tx) {
  await tx.rolePermission.deleteMany();
  await tx.userRole.deleteMany();
  await tx.role.deleteMany();
  await tx.permission.deleteMany();
}

// La auditoría es de solo lectura: se desactiva su trigger solo dentro de esta transacción
// para borrar los registros de los usuarios de la prueba y poder eliminarlos.
export async function deleteAuditLogsOfPeople(
  prisma: { $transaction: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T> },
  personIds: string[],
) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`ALTER TABLE "audit_logs" DISABLE TRIGGER "audit_logs_read_only"`;
    await tx.auditLog.deleteMany({ where: { user: { personId: { in: personIds } } } });
    await tx.$executeRaw`ALTER TABLE "audit_logs" ENABLE TRIGGER "audit_logs_read_only"`;
  });
}
