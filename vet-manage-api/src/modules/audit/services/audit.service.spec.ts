import { describe, expect, it, vi } from 'vitest';
import { AUDIT_ACTIONS, AUDIT_MODULES } from '../audit.catalog.js';
import { AuditService } from './audit.service.js';

function buildTx(roles: { displayName: string }[]) {
  return {
    role: { findMany: vi.fn().mockResolvedValue(roles) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
}

const entry = {
  actorId: 'user-1',
  action: AUDIT_ACTIONS.register,
  module: AUDIT_MODULES.clients,
  affectedRecord: '1710000017 - Juan Pérez',
};

describe('AuditService.record', () => {
  it('guarda usuario, rol, acción, módulo y registro afectado con el cliente de la transacción', async () => {
    const tx = buildTx([{ displayName: 'Recepcionista' }]);

    await new AuditService().record(tx as never, entry);

    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        role: 'Recepcionista',
        action: 'Registrar',
        module: 'Clientes',
        affectedRecord: '1710000017 - Juan Pérez',
      },
    });
  });

  it('une varios roles en orden alfabético', async () => {
    const tx = buildTx([{ displayName: 'Veterinario' }, { displayName: 'Gerente' }]);

    await new AuditService().record(tx as never, entry);

    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: 'Gerente, Veterinario' }) }),
    );
  });

  it('solo consulta los roles activos y vigentes del actor', async () => {
    const tx = buildTx([]);

    await new AuditService().record(tx as never, entry);

    const { where } = tx.role.findMany.mock.calls[0][0];
    expect(where.isActive).toBe(true);
    expect(where.userRoles.some.userId).toBe('user-1');
    expect(where.userRoles.some.OR).toEqual([{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }]);
  });

  it('propaga el error si no se puede guardar, para que la transacción falle', async () => {
    const tx = buildTx([{ displayName: 'Recepcionista' }]);
    tx.auditLog.create.mockRejectedValue(new Error('fallo de base de datos'));

    await expect(new AuditService().record(tx as never, entry)).rejects.toThrow('fallo de base de datos');
  });
});
