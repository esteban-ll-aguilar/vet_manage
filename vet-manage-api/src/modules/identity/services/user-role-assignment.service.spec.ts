import { describe, expect, it, vi } from 'vitest';
import { ApiException } from '../../../common/errors/api-exception.js';
import { ROLE_ASSIGNMENT_MESSAGES, UserRoleAssignmentService } from './user-role-assignment.service.js';

type Tx = {
  user: { findUnique: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> };
  role: { findMany: ReturnType<typeof vi.fn> };
  userRole: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; deleteMany: ReturnType<typeof vi.fn> };
};

function build(tx: Tx, view: unknown) {
  const prisma = {
    $transaction: vi.fn(async (run: (client: Tx) => Promise<void>) => run(tx)),
    user: { findUnique: vi.fn() },
    role: { findMany: vi.fn() },
  };
  const audit = { record: vi.fn(async () => undefined) };
  const service = new UserRoleAssignmentService(prisma as never, audit as never);
  const getSpy = vi.spyOn(service, 'get').mockResolvedValue(view as never);
  return { prisma, tx, service, getSpy, audit };
}

const now = new Date('2026-11-19T12:00:00Z');

function baseUser(overrides: Partial<{ status: string; userRoles: unknown[] }> = {}) {
  return {
    id: 'u-1',
    status: 'ACTIVE',
    person: { identification: '1710034065', firstName: 'María', lastName: 'López' },
    userRoles: [
      {
        id: 'ur-rec',
        roleId: 'role-rec',
        expiresAt: null,
        role: { name: 'receptionist', isActive: true },
      },
      ...(overrides.userRoles ?? []),
    ],
    ...overrides,
  };
}

describe('UserRoleAssignmentService.update', () => {
  it('asigna un rol adicional conservando los actuales', async () => {
    const tx: Tx = {
      user: {
        findUnique: vi.fn().mockResolvedValue(baseUser()),
        count: vi.fn(),
      },
      role: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'role-rec', name: 'receptionist' },
          { id: 'role-cash', name: 'cashier' },
        ]),
      },
      userRole: { create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
    };
    const view = { user: { id: 'u-1' }, currentRoles: [], availableRoles: [] };
    const { service } = build(tx, view);

    const result = await service.update('u-1', ['receptionist', 'cashier'], 'admin-1');

    expect(result).toBe(view);
    expect(tx.userRole.create).toHaveBeenCalledWith({
      data: { userId: 'u-1', roleId: 'role-cash', assignedById: 'admin-1' },
    });
    expect(tx.userRole.deleteMany).not.toHaveBeenCalled();
  });

  it('quita un rol y conserva los demás', async () => {
    const tx: Tx = {
      user: {
        findUnique: vi.fn().mockResolvedValue(baseUser({
          userRoles: [
            { id: 'ur-rec', roleId: 'role-rec', expiresAt: null, role: { name: 'receptionist', isActive: true } },
            { id: 'ur-cash', roleId: 'role-cash', expiresAt: null, role: { name: 'cashier', isActive: true } },
          ],
        })),
        count: vi.fn(),
      },
      role: { findMany: vi.fn().mockResolvedValue([{ id: 'role-rec', name: 'receptionist' }]) },
      userRole: { create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
    };
    const { service } = build(tx, {});

    await service.update('u-1', ['receptionist'], 'admin-1');

    expect(tx.userRole.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['ur-cash'] } } });
  });

  it('cambia de función reemplazando el rol y reactiva asignaciones vencidas', async () => {
    vi.setSystemTime(now);
    const tx: Tx = {
      user: {
        findUnique: vi.fn().mockResolvedValue(baseUser({
          userRoles: [
            { id: 'ur-rec', roleId: 'role-rec', expiresAt: null, role: { name: 'receptionist', isActive: true } },
            { id: 'ur-vet', roleId: 'role-vet', expiresAt: new Date('2026-11-01T00:00:00Z'), role: { name: 'veterinarian', isActive: true } },
          ],
        })),
        count: vi.fn(),
      },
      role: { findMany: vi.fn().mockResolvedValue([{ id: 'role-vet', name: 'veterinarian' }]) },
      userRole: { create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
    };
    const { service } = build(tx, {});

    await service.update('u-1', ['veterinarian'], 'admin-1');

    expect(tx.userRole.update).toHaveBeenCalledWith({
      where: { id: 'ur-vet' },
      data: { expiresAt: null, assignedById: 'admin-1' },
    });
    expect(tx.userRole.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['ur-rec'] } } });
    vi.useRealTimers();
  });

  describe('auditoría', () => {
    const unchangedTx = (): Tx => ({
      user: { findUnique: vi.fn().mockResolvedValue(baseUser()), count: vi.fn() },
      role: { findMany: vi.fn().mockResolvedValue([{ id: 'role-rec', name: 'receptionist' }]) },
      userRole: { create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
    });

    it('registra "Asignar roles" en la transacción cuando cambian los roles', async () => {
      const tx = unchangedTx();
      tx.role.findMany.mockResolvedValue([
        { id: 'role-rec', name: 'receptionist' },
        { id: 'role-cash', name: 'cashier' },
      ]);
      const { service, audit } = build(tx, {});

      await service.update('u-1', ['receptionist', 'cashier'], 'admin-1');

      expect(audit.record).toHaveBeenCalledTimes(1);
      expect(audit.record).toHaveBeenCalledWith(tx, {
        actorId: 'admin-1',
        action: 'Asignar roles',
        module: 'Usuarios',
        affectedRecord: '1710034065 - María López',
      });
    });

    it('registra la acción antes de aplicar los cambios de roles', async () => {
      const tx = unchangedTx();
      tx.role.findMany.mockResolvedValue([
        { id: 'role-rec', name: 'receptionist' },
        { id: 'role-cash', name: 'cashier' },
      ]);
      const { service, audit } = build(tx, {});

      await service.update('u-1', ['receptionist', 'cashier'], 'admin-1');

      expect(audit.record.mock.invocationCallOrder[0]).toBeLessThan(tx.userRole.create.mock.invocationCallOrder[0]);
    });

    it('registra la acción cuando solo se quita un rol', async () => {
      const tx = unchangedTx();
      tx.user.findUnique.mockResolvedValue(baseUser({
        userRoles: [{ id: 'ur-cash', roleId: 'role-cash', expiresAt: null, role: { name: 'cashier', isActive: true } }],
      }));
      const { service, audit } = build(tx, {});

      await service.update('u-1', ['receptionist'], 'admin-1');

      expect(tx.userRole.deleteMany).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledTimes(1);
    });

    it('no registra nada cuando se guardan los mismos roles', async () => {
      const tx = unchangedTx();
      const { service, audit } = build(tx, {});

      await service.update('u-1', ['receptionist'], 'admin-1');

      expect(tx.userRole.create).not.toHaveBeenCalled();
      expect(tx.userRole.deleteMany).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('no registra nada cuando la solicitud se rechaza', async () => {
      const tx = unchangedTx();
      tx.user.findUnique.mockResolvedValue(null);
      const { service, audit } = build(tx, {});

      await expect(service.update('u-1', ['receptionist'], 'admin-1')).rejects.toMatchObject({ statusCode: 404 });
      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  it('rechaza guardar sin roles efectivos', async () => {
    const tx: Tx = {
      user: { findUnique: vi.fn(), count: vi.fn() },
      role: { findMany: vi.fn() },
      userRole: { create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
    };
    const { service } = build(tx, {});

    await expect(service.update('u-1', ['  '], 'admin-1')).rejects.toMatchObject({
      statusCode: 400,
      message: ROLE_ASSIGNMENT_MESSAGES.atLeastOne,
    });
    expect(tx.user.findUnique).not.toHaveBeenCalled();
  });

  it('rechaza quitar el último administrador activo', async () => {
    vi.setSystemTime(now);
    const tx: Tx = {
      user: {
        findUnique: vi.fn().mockResolvedValue(baseUser({
          userRoles: [
            { id: 'ur-admin', roleId: 'role-admin', expiresAt: null, role: { name: 'administrator', isActive: true } },
          ],
        })),
        count: vi.fn().mockResolvedValue(0),
      },
      role: { findMany: vi.fn().mockResolvedValue([{ id: 'role-rec', name: 'receptionist' }]) },
      userRole: { create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
    };
    const { service } = build(tx, {});

    await expect(service.update('u-1', ['receptionist'], 'admin-1')).rejects.toMatchObject({
      statusCode: 400,
      message: ROLE_ASSIGNMENT_MESSAGES.lastAdmin,
    });
    expect(tx.userRole.create).not.toHaveBeenCalled();
    expect(tx.userRole.deleteMany).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('rechaza modificar roles de un usuario dado de baja', async () => {
    const tx: Tx = {
      user: { findUnique: vi.fn().mockResolvedValue(baseUser({ status: 'DEACTIVATED' })), count: vi.fn() },
      role: { findMany: vi.fn().mockResolvedValue([{ id: 'role-rec', name: 'receptionist' }]) },
      userRole: { create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
    };
    const { service } = build(tx, {});

    await expect(service.update('u-1', ['receptionist'], 'admin-1')).rejects.toMatchObject({
      statusCode: 400,
      message: ROLE_ASSIGNMENT_MESSAGES.deactivated,
    });
    expect(tx.userRole.create).not.toHaveBeenCalled();
  });

  it('rechaza roles no asignables', async () => {
    const tx: Tx = {
      user: { findUnique: vi.fn().mockResolvedValue(baseUser()), count: vi.fn() },
      role: { findMany: vi.fn().mockResolvedValue([]) },
      userRole: { create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
    };
    const { service } = build(tx, {});

    const error = await service.update('u-1', ['client'], 'admin-1').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).message).toBe(ROLE_ASSIGNMENT_MESSAGES.invalidRoles);
  });
});
