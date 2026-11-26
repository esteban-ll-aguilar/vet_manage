import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ApiException } from '../../../common/errors/api-exception.js';
import { PERMISSIONS_METADATA } from '../decorators/require-permissions.decorator.js';
import { UsersController } from '../users.controller.js';
import { DEACTIVATE_USER_MESSAGES, DeactivateUserService } from './deactivate-user.service.js';

type Tx = {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  userRole: {
    deleteMany: ReturnType<typeof vi.fn>;
  };
  userSession: {
    updateMany: ReturnType<typeof vi.fn>;
  };
};

function build(tx: Tx) {
  const prisma = {
    $transaction: vi.fn(async (run: (client: Tx) => Promise<unknown>) => run(tx)),
  };
  const audit = { record: vi.fn(async () => undefined) };
  const service = new DeactivateUserService(prisma as never, audit as never);
  return { prisma, tx, service, audit };
}

function baseTx(userOverrides: Record<string, unknown> = {}): Tx {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'u-vet',
        status: 'ACTIVE',
        person: { identification: '1104567890', firstName: 'Luis', lastName: 'Torres' },
        userRoles: [
          {
            id: 'ur-1',
            expiresAt: null,
            role: { name: 'veterinarian', displayName: 'Veterinario', category: 'STAFF', isActive: true },
          },
        ],
        ...userOverrides,
      }),
      count: vi.fn().mockResolvedValue(1),
      update: vi.fn().mockResolvedValue(undefined),
    },
    userRole: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    userSession: {
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
  };
}

describe('DeactivateUserService', () => {
  it('da de baja una cuenta activa con fecha, motivo, revocación de sesiones y auditoría', async () => {
    const tx = baseTx();
    const { service, audit } = build(tx);

    const result = await service.deactivate('u-vet', { reason: '  Renuncia  ' }, 'u-admin');

    expect(result).toEqual({
      message: DEACTIVATE_USER_MESSAGES.deactivated,
      user: {
        id: 'u-vet',
        status: 'DEACTIVATED',
        deactivatedAt: expect.any(Date),
        deactivationReason: 'Renuncia',
        roles: [{ name: 'veterinarian', displayName: 'Veterinario' }],
      },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'u-vet' },
      data: {
        status: 'DEACTIVATED',
        deactivatedAt: expect.any(Date),
        deactivationReason: 'Renuncia',
      },
    });
    expect(tx.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u-vet', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(audit.record).toHaveBeenCalledWith(tx, {
      actorId: 'u-admin',
      action: 'Dar de baja',
      module: 'Usuarios',
      affectedRecord: '1104567890 - Luis Torres',
      previousValue: { status: 'Activo' },
      newValue: { status: 'Dado de baja', reason: 'Renuncia' },
    });
  });

  it('permite dar de baja una cuenta inactiva', async () => {
    const tx = baseTx({ status: 'INACTIVE' });
    const { service, audit } = build(tx);

    const result = await service.deactivate('u-vet', { reason: 'Fin de contrato' }, 'u-admin');

    expect(result.user.status).toBe('DEACTIVATED');
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        previousValue: { status: 'Inactivo' },
        newValue: { status: 'Dado de baja', reason: 'Fin de contrato' },
      }),
    );
  });

  it.each([undefined, '', '   '])('exige ingresar el motivo de la baja (valor: %j)', async (reason) => {
    const tx = baseTx();
    const { service, prisma, audit } = build(tx);

    await expect(service.deactivate('u-vet', { reason }, 'u-admin')).rejects.toMatchObject({
      statusCode: 400,
      message: DEACTIVATE_USER_MESSAGES.missingReason,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('impide dar de baja la propia cuenta del Administrador', async () => {
    const tx = baseTx({
      id: 'u-admin',
      userRoles: [
        {
          id: 'ur-admin',
          expiresAt: null,
          role: { name: 'administrator', displayName: 'Administrador', category: 'STAFF', isActive: true },
        },
      ],
    });
    const { service, audit } = build(tx);

    await expect(service.deactivate('u-admin', { reason: 'Renuncia' }, 'u-admin')).rejects.toMatchObject({
      statusCode: 400,
      message: DEACTIVATE_USER_MESSAGES.selfDeactivation,
    });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('impide dar de baja al último Administrador activo', async () => {
    const tx = baseTx({
      id: 'u-admin-2',
      userRoles: [
        {
          id: 'ur-admin',
          expiresAt: null,
          role: { name: 'administrator', displayName: 'Administrador', category: 'STAFF', isActive: true },
        },
      ],
    });
    tx.user.count.mockResolvedValue(0);
    const { service, audit } = build(tx);

    await expect(service.deactivate('u-admin-2', { reason: 'Renuncia' }, 'u-actor')).rejects.toMatchObject({
      statusCode: 400,
      message: DEACTIVATE_USER_MESSAGES.lastAdmin,
    });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('si la persona también es Cliente, retira solo los roles de personal y conserva el acceso como Cliente', async () => {
    const tx = baseTx({
      id: 'u-ana',
      person: { identification: '1104567891', firstName: 'Ana', lastName: 'Ruiz' },
      userRoles: [
        {
          id: 'ur-staff',
          expiresAt: null,
          role: { name: 'cashier', displayName: 'Cajero', category: 'STAFF', isActive: true },
        },
        {
          id: 'ur-client',
          expiresAt: null,
          role: { name: 'client', displayName: 'Cliente', category: 'CLIENT', isActive: true },
        },
      ],
    });
    const { service, audit } = build(tx);

    const result = await service.deactivate('u-ana', { reason: 'Renuncia' }, 'u-admin');

    expect(result).toEqual({
      message: DEACTIVATE_USER_MESSAGES.deactivated,
      user: {
        id: 'u-ana',
        status: 'ACTIVE',
        deactivatedAt: null,
        deactivationReason: null,
        roles: [{ name: 'client', displayName: 'Cliente' }],
      },
    });
    expect(tx.userRole.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['ur-staff'] } },
    });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u-ana', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(audit.record).toHaveBeenCalledWith(tx, {
      actorId: 'u-admin',
      action: 'Dar de baja',
      module: 'Usuarios',
      affectedRecord: '1104567891 - Ana Ruiz',
      previousValue: { status: 'Activo', roles: ['Cajero', 'Cliente'] },
      newValue: { status: 'Activo', roles: ['Cliente'], reason: 'Renuncia' },
    });
  });

  it('rechaza un usuario inexistente o ya dado de baja', async () => {
    const missingTx = baseTx();
    missingTx.user.findUnique.mockResolvedValue(null);
    const { service: missingService } = build(missingTx);

    const notFound = await missingService.deactivate('missing', { reason: 'Renuncia' }, 'u-admin').catch((e: unknown) => e);
    expect(notFound).toBeInstanceOf(ApiException);
    expect((notFound as ApiException).statusCode).toBe(404);

    const deactivatedTx = baseTx({ status: 'DEACTIVATED' });
    const { service: deactivatedService } = build(deactivatedTx);
    await expect(
      deactivatedService.deactivate('u-vet', { reason: 'Renuncia' }, 'u-admin'),
    ).rejects.toMatchObject({ statusCode: 400, message: DEACTIVATE_USER_MESSAGES.alreadyDeactivated });
  });

  it('exige el permiso users:deactivate en el controlador', () => {
    const descriptor = Object.getOwnPropertyDescriptor(UsersController.prototype, 'deactivate')?.value as object;
    const permissions = Reflect.getMetadata(PERMISSIONS_METADATA, descriptor) as string[] | undefined;

    expect(permissions).toEqual(['users:deactivate']);
  });
});
