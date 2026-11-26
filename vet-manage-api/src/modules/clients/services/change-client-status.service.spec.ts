import { describe, expect, it, vi } from 'vitest';
import { ApiException } from '../../../common/errors/api-exception.js';
import { ChangeClientStatusService, CLIENT_STATUS_MESSAGES } from './change-client-status.service.js';

type Tx = {
  client: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

function build(tx: Tx) {
  const prisma = {
    $transaction: vi.fn(async (run: (client: Tx) => Promise<void>) => run(tx)),
  };
  const audit = { record: vi.fn(async () => undefined) };
  const service = new ChangeClientStatusService(prisma as never, audit as never);
  return { prisma, tx, service, audit };
}

function baseTx(clientOverrides: Record<string, unknown> = {}): Tx {
  return {
    client: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'c-1',
        status: 'ACTIVE',
        person: { identification: '1104567890', firstName: 'Juan', lastName: 'Pérez' },
        ...clientOverrides,
      }),
      update: vi.fn().mockResolvedValue(undefined),
    },
  };
}

describe('ChangeClientStatusService', () => {
  it('inactiva un cliente activo y registra la auditoría en la misma transacción', async () => {
    const tx = baseTx();
    const { service, audit } = build(tx);

    const result = await service.inactivate('c-1', 'u-receptionist');

    expect(result).toEqual({
      message: CLIENT_STATUS_MESSAGES.inactivated,
      client: { id: 'c-1', status: 'INACTIVE' },
    });
    expect(tx.client.update).toHaveBeenCalledWith({
      where: { id: 'c-1' },
      data: { status: 'INACTIVE' },
    });
    expect(audit.record).toHaveBeenCalledWith(tx, {
      actorId: 'u-receptionist',
      action: 'Inactivar',
      module: 'Clientes',
      affectedRecord: '1104567890 - Juan Pérez',
      previousValue: { status: 'Activo' },
      newValue: { status: 'Inactivo' },
    });
  });

  it('devuelve 404 si el cliente no existe y no registra auditoría', async () => {
    const tx = baseTx();
    tx.client.findUnique.mockResolvedValue(null);
    const { service, audit } = build(tx);

    await expect(service.inactivate('c-missing', 'u-receptionist')).rejects.toMatchObject({
      statusCode: 404,
      message: CLIENT_STATUS_MESSAGES.notFound,
    });
    expect(tx.client.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('rechaza inactivar un cliente dado de baja', async () => {
    const tx = baseTx({ status: 'DEACTIVATED' });
    const { service, audit } = build(tx);

    const error = await service.inactivate('c-1', 'u-manager').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).statusCode).toBe(400);
    expect((error as ApiException).message).toBe(CLIENT_STATUS_MESSAGES.deactivated);
    expect(tx.client.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('es idempotente si el cliente ya está inactivo y no duplica auditoría', async () => {
    const tx = baseTx({ status: 'INACTIVE' });
    const { service, audit } = build(tx);

    const result = await service.inactivate('c-1', 'u-receptionist');

    expect(result).toEqual({
      message: CLIENT_STATUS_MESSAGES.inactivated,
      client: { id: 'c-1', status: 'INACTIVE' },
    });
    expect(tx.client.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  describe('activate (HU-05)', () => {
    it('activa un cliente inactivo y registra la fecha y el usuario en la auditoría', async () => {
      const tx = baseTx({ status: 'INACTIVE' });
      const { service, audit } = build(tx);

      const result = await service.activate('c-1', 'u-receptionist');

      expect(result).toEqual({
        message: 'Cliente activado correctamente',
        client: { id: 'c-1', status: 'ACTIVE' },
      });
      expect(tx.client.update).toHaveBeenCalledWith({
        where: { id: 'c-1' },
        data: { status: 'ACTIVE' },
      });
      expect(audit.record).toHaveBeenCalledWith(tx, {
        actorId: 'u-receptionist',
        action: 'Activar',
        module: 'Clientes',
        affectedRecord: '1104567890 - Juan Pérez',
        previousValue: { status: 'Inactivo' },
        newValue: { status: 'Activo' },
      });
    });

    it('es idempotente si el cliente ya está activo y no registra auditoría', async () => {
      const tx = baseTx({ status: 'ACTIVE' });
      const { service, audit } = build(tx);

      const result = await service.activate('c-1', 'u-manager');

      expect(result).toEqual({
        message: CLIENT_STATUS_MESSAGES.activated,
        client: { id: 'c-1', status: 'ACTIVE' },
      });
      expect(tx.client.update).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('devuelve 404 si el cliente no existe', async () => {
      const tx = baseTx();
      tx.client.findUnique.mockResolvedValue(null);
      const { service, audit } = build(tx);

      await expect(service.activate('c-missing', 'u-manager')).rejects.toMatchObject({
        statusCode: 404,
        message: 'Cliente no encontrado',
      });
      expect(tx.client.update).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('rechaza activar un cliente dado de baja sin escribir ni auditar (R-05)', async () => {
      const tx = baseTx({ status: 'DEACTIVATED' });
      const { service, audit } = build(tx);

      const error = await service.activate('c-1', 'u-manager').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ApiException);
      expect(error).toMatchObject({
        statusCode: 400,
        message: 'No se puede activar un cliente dado de baja',
        code: 'CLIENT_STATUS_DEACTIVATED',
      });
      expect(tx.client.update).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  describe('deactivate (HU-03 Dar de baja un cliente)', () => {
    const NOW = new Date('2026-11-24T15:00:00.000Z');

    // Positivos
    it.each([
      ['ACTIVE', 'Activo'],
      ['INACTIVE', 'Inactivo'],
    ])('da de baja un cliente %s, guarda fecha, responsable y motivo y audita "Dar de baja"', async (status, label) => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);
      const tx = baseTx({ status });
      const { service, audit } = build(tx);

      const result = await service.deactivate('c-1', 'Se mudó de ciudad', 'u-manager');

      expect(result).toEqual({
        message: 'Cliente dado de baja correctamente',
        client: { id: 'c-1', status: 'DEACTIVATED', deactivatedAt: NOW.toISOString(), deactivationReason: 'Se mudó de ciudad' },
      });
      expect(tx.client.update).toHaveBeenCalledWith({
        where: { id: 'c-1' },
        data: { status: 'DEACTIVATED', deactivatedAt: NOW, deactivatedById: 'u-manager', deactivationReason: 'Se mudó de ciudad' },
      });
      expect(audit.record).toHaveBeenCalledWith(tx, {
        actorId: 'u-manager',
        action: 'Dar de baja',
        module: 'Clientes',
        affectedRecord: '1104567890 - Juan Pérez',
        previousValue: { status: label },
        newValue: { status: 'De baja', reason: 'Se mudó de ciudad' },
      });
      vi.useRealTimers();
    });

    it('guarda el motivo sin espacios al inicio ni al final', async () => {
      const tx = baseTx();
      const { service } = build(tx);

      await service.deactivate('c-1', '   Solicitud del cliente  ', 'u-vet');

      expect(tx.client.update.mock.calls[0][0].data.deactivationReason).toBe('Solicitud del cliente');
    });

    // Negativos
    it.each([
      ['sin motivo', undefined],
      ['con motivo vacío', ''],
      ['con motivo solo con espacios', '    '],
    ])('rechaza la baja %s (400) sin abrir la transacción', async (_, reason) => {
      const tx = baseTx();
      const { service, audit, prisma } = build(tx);

      const error = await service.deactivate('c-1', reason, 'u-manager').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ApiException);
      expect(error).toMatchObject({ statusCode: 400, message: 'Ingrese el motivo de la baja', errors: ['reason'] });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('devuelve 404 si el cliente no existe y no audita', async () => {
      const tx = baseTx();
      tx.client.findUnique.mockResolvedValue(null);
      const { service, audit } = build(tx);

      await expect(service.deactivate('c-missing', 'Motivo', 'u-manager')).rejects.toMatchObject({
        statusCode: 404,
        message: 'Cliente no encontrado',
      });
      expect(tx.client.update).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('rechaza un cliente ya dado de baja con «El cliente está desactivado» (409) sin cambiar nada', async () => {
      const tx = baseTx({ status: 'DEACTIVATED' });
      const { service, audit } = build(tx);

      await expect(service.deactivate('c-1', 'Motivo', 'u-manager')).rejects.toMatchObject({
        statusCode: 409,
        message: 'El cliente está desactivado',
      });
      expect(tx.client.update).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('si falla la auditoría, la baja falla (misma transacción)', async () => {
      const tx = baseTx();
      const { service, audit } = build(tx);
      audit.record.mockRejectedValueOnce(new Error('fallo de auditoría'));

      await expect(service.deactivate('c-1', 'Motivo', 'u-manager')).rejects.toThrow('fallo de auditoría');
    });

    // Valor límite
    it.each([
      ['1 carácter', 'X'],
      ['500 caracteres', 'm'.repeat(500)],
    ])('acepta un motivo de %s', async (_, reason) => {
      const tx = baseTx();
      const { service } = build(tx);

      const result = await service.deactivate('c-1', reason, 'u-manager');

      expect(result.client.deactivationReason).toBe(reason);
    });

    it('rechaza un motivo de 501 caracteres (400)', async () => {
      const tx = baseTx();
      const { service, prisma } = build(tx);

      await expect(service.deactivate('c-1', 'm'.repeat(501), 'u-manager')).rejects.toMatchObject({
        statusCode: 400,
        message: 'El motivo no puede superar 500 caracteres',
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('cuenta los 500 caracteres sin los espacios exteriores', async () => {
      const tx = baseTx();
      const { service } = build(tx);

      await expect(service.deactivate('c-1', `  ${'m'.repeat(500)}  `, 'u-manager')).resolves.toMatchObject({
        client: { status: 'DEACTIVATED' },
      });
    });
  });
});
