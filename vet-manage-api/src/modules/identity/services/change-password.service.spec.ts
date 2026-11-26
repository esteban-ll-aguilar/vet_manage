import { describe, expect, it, vi } from 'vitest';
import { ApiException } from '../../../common/errors/api-exception.js';
import { CHANGE_PASSWORD_MESSAGES, ChangePasswordService } from './change-password.service.js';

type Tx = {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

function build(tx: Tx, verifyImpl?: (plain: string, hash: string) => Promise<boolean>) {
  const prisma = {
    $transaction: vi.fn(async (run: (client: Tx) => Promise<void>) => run(tx)),
  };
  const hasher = {
    verify: vi.fn(verifyImpl ?? (async (plain: string) => plain === 'Actual123')),
    hash: vi.fn(async (plain: string) => `hashed:${plain}`),
  };
  const audit = { record: vi.fn(async () => undefined) };
  const service = new ChangePasswordService(prisma as never, hasher as never, audit as never);
  return { prisma, tx, hasher, audit, service };
}

function baseTx(overrides: Record<string, unknown> = {}): Tx {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'u-1',
        password: 'stored-hash-Actual123',
        status: 'ACTIVE',
        person: { identification: '1104567890', firstName: 'Luis', lastName: 'Torres' },
        ...overrides,
      }),
      update: vi.fn().mockResolvedValue(undefined),
    },
  };
}

describe('ChangePasswordService', () => {
  it('actualiza la contraseña, limpia mustChangePassword y registra auditoría sin contraseñas', async () => {
    const tx = baseTx();
    const { service, hasher, audit } = build(tx);

    const result = await service.changePassword('u-1', {
      currentPassword: 'Actual123',
      newPassword: 'NuevaClave1',
      confirmPassword: 'NuevaClave1',
    });

    expect(result).toEqual({ message: CHANGE_PASSWORD_MESSAGES.updated });
    expect(hasher.hash).toHaveBeenCalledWith('NuevaClave1');
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: { password: 'hashed:NuevaClave1', mustChangePassword: false },
    });
    expect(audit.record).toHaveBeenCalledWith(tx, {
      actorId: 'u-1',
      action: 'Cambiar contraseña',
      module: 'Usuarios',
      affectedRecord: '1104567890 - Luis Torres',
    });
  });

  it('rechaza cuando la contraseña actual es incorrecta', async () => {
    const tx = baseTx();
    const { service, audit } = build(tx);

    await expect(
      service.changePassword('u-1', {
        currentPassword: 'Incorrecta1',
        newPassword: 'NuevaClave1',
        confirmPassword: 'NuevaClave1',
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: CHANGE_PASSWORD_MESSAGES.wrongCurrent,
    });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('rechaza una nueva contraseña que no cumple la política de seguridad', async () => {
    const tx = baseTx();
    const { service, audit } = build(tx);

    await expect(
      service.changePassword('u-1', {
        currentPassword: 'Actual123',
        newPassword: 'clave1',
        confirmPassword: 'clave1',
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: CHANGE_PASSWORD_MESSAGES.weakPassword,
    });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('rechaza cuando la confirmación no coincide con la nueva contraseña', async () => {
    const tx = baseTx();
    const { service, audit } = build(tx);

    await expect(
      service.changePassword('u-1', {
        currentPassword: 'Actual123',
        newPassword: 'NuevaClave1',
        confirmPassword: 'OtraClave1',
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: CHANGE_PASSWORD_MESSAGES.mismatch,
    });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('rechaza cuando la nueva contraseña es igual a la actual', async () => {
    const tx = baseTx();
    const { service, audit } = build(tx);

    await expect(
      service.changePassword('u-1', {
        currentPassword: 'Actual123',
        newPassword: 'Actual123',
        confirmPassword: 'Actual123',
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: CHANGE_PASSWORD_MESSAGES.sameAsCurrent,
    });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('rechaza campos vacíos', async () => {
    const tx = baseTx();
    const { service } = build(tx);

    const error = await service
      .changePassword('u-1', { currentPassword: '', newPassword: 'NuevaClave1', confirmPassword: 'NuevaClave1' })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).statusCode).toBe(400);
    expect((error as ApiException).message).toBe(CHANGE_PASSWORD_MESSAGES.missing);
  });
});
