import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ApiException } from '../../../common/errors/api-exception.js';
import { PERMISSIONS_METADATA } from '../decorators/require-permissions.decorator.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { UsersController } from '../users.controller.js';
import { ChangeUserStatusService, USER_STATUS_MESSAGES } from './change-user-status.service.js';

type Tx = {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  userSession: {
    updateMany: ReturnType<typeof vi.fn>;
  };
};

function build(tx: Tx) {
  const prisma = {
    $transaction: vi.fn(async (run: (client: Tx) => Promise<void>) => run(tx)),
  };
  const audit = { record: vi.fn(async () => undefined) };
  const service = new ChangeUserStatusService(prisma as never, audit as never);
  return { prisma, tx, service, audit };
}

function baseTx(userOverrides: Record<string, unknown> = {}): Tx {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'u-vet',
        status: 'ACTIVE',
        person: { identification: '1104567890', firstName: 'Luis', lastName: 'Torres' },
        userRoles: [{ role: { name: 'veterinarian' } }],
        ...userOverrides,
      }),
      count: vi.fn().mockResolvedValue(1),
      update: vi.fn().mockResolvedValue(undefined),
    },
    userSession: {
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
  };
}

describe('ChangeUserStatusService', () => {
  it('inactiva una cuenta activa, revoca sesiones abiertas y registra auditoría atómica', async () => {
    const tx = baseTx();
    const { service, audit } = build(tx);

    const result = await service.changeStatus('u-vet', 'INACTIVE', 'u-admin');

    expect(result).toEqual({
      message: USER_STATUS_MESSAGES.inactivated,
      user: { id: 'u-vet', status: 'INACTIVE' },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'u-vet' },
      data: { status: 'INACTIVE' },
    });
    expect(tx.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u-vet', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(audit.record).toHaveBeenCalledWith(tx, {
      actorId: 'u-admin',
      action: 'Inactivar',
      module: 'Usuarios',
      affectedRecord: '1104567890 - Luis Torres',
      previousValue: { status: 'Activo' },
      newValue: { status: 'Inactivo' },
    });
  });

  it('reactiva una cuenta inactiva y registra auditoría sin revocar sesiones', async () => {
    const tx = baseTx({ status: 'INACTIVE' });
    const { service, audit } = build(tx);

    const result = await service.changeStatus('u-vet', 'ACTIVE', 'u-admin');

    expect(result).toEqual({
      message: USER_STATUS_MESSAGES.activated,
      user: { id: 'u-vet', status: 'ACTIVE' },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'u-vet' },
      data: { status: 'ACTIVE' },
    });
    expect(tx.userSession.updateMany).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(tx, {
      actorId: 'u-admin',
      action: 'Activar',
      module: 'Usuarios',
      affectedRecord: '1104567890 - Luis Torres',
      previousValue: { status: 'Inactivo' },
      newValue: { status: 'Activo' },
    });
  });

  it('impide inactivar la propia cuenta del Administrador', async () => {
    const tx = baseTx({
      id: 'u-admin',
      userRoles: [{ role: { name: 'administrator' } }],
    });
    const { service, audit } = build(tx);

    await expect(service.changeStatus('u-admin', 'INACTIVE', 'u-admin')).rejects.toMatchObject({
      statusCode: 400,
      message: USER_STATUS_MESSAGES.selfInactivation,
    });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.userSession.updateMany).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('impide inactivar al último Administrador activo', async () => {
    const tx = baseTx({
      id: 'u-admin-2',
      userRoles: [{ role: { name: 'administrator' } }],
    });
    tx.user.count.mockResolvedValue(0);
    const { service, audit } = build(tx);

    await expect(service.changeStatus('u-admin-2', 'INACTIVE', 'u-actor')).rejects.toMatchObject({
      statusCode: 400,
      message: USER_STATUS_MESSAGES.lastAdmin,
    });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.userSession.updateMany).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('permite inactivar a un Administrador si existe otro Administrador activo', async () => {
    const tx = baseTx({
      id: 'u-admin-2',
      userRoles: [{ role: { name: 'administrator' } }],
    });
    tx.user.count.mockResolvedValue(1);
    const { service, audit } = build(tx);

    const result = await service.changeStatus('u-admin-2', 'INACTIVE', 'u-admin-1');

    expect(result.user.status).toBe('INACTIVE');
    expect(tx.user.update).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledTimes(1);
  });

  it('rechaza cambiar el estado de un usuario dado de baja', async () => {
    const tx = baseTx({ status: 'DEACTIVATED' });
    const { service, audit } = build(tx);

    const error = await service.changeStatus('u-vet', 'ACTIVE', 'u-admin').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).statusCode).toBe(400);
    expect((error as ApiException).message).toBe(USER_STATUS_MESSAGES.deactivated);
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('devuelve 404 si el usuario no existe', async () => {
    const tx = baseTx();
    tx.user.findUnique.mockResolvedValue(null);
    const { service, audit } = build(tx);

    await expect(service.changeStatus('u-missing', 'INACTIVE', 'u-admin')).rejects.toMatchObject({
      statusCode: 404,
      message: USER_STATUS_MESSAGES.userNotFound,
    });
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('no modifica ni duplica auditoría si el estado ya es el solicitado', async () => {
    const tx = baseTx({ status: 'INACTIVE' });
    const { service, audit } = build(tx);

    const result = await service.changeStatus('u-vet', 'INACTIVE', 'u-admin');

    expect(result.user.status).toBe('INACTIVE');
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.userSession.updateMany).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('exige el permiso users:change-status en el controlador', () => {
    const permissions = Reflect.getMetadata(
      PERMISSIONS_METADATA,
      UsersController.prototype.changeStatus,
    ) as string[] | undefined;

    expect(permissions).toEqual(['users:change-status']);
  });

  it('rechaza con 401 la siguiente acción de un usuario inactivado en JwtAuthGuard (R-12)', async () => {
    const tokens = { verify: vi.fn().mockResolvedValue('u-vet') };
    const access = { findActiveUser: vi.fn().mockResolvedValue(null) };
    const guard = new JwtAuthGuard(tokens as never, access as never);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: 'Bearer valid-token' } }),
      }),
    };

    await expect(guard.canActivate(context as never)).rejects.toMatchObject({
      statusCode: 401,
    });
  });
});
