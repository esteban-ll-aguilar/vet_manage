import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiException } from '../../../common/errors/api-exception.js';
import type { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';
import type { MailService } from '../../../infrastructure/mail/mail.service.js';
import type { AuditService } from '../../audit/services/audit.service.js';
import { PERMISSIONS_METADATA } from '../decorators/require-permissions.decorator.js';
import { UsersController } from '../users.controller.js';
import { UpdateUserService } from './update-user.service.js';

const storedUser = (status = 'ACTIVE') => ({
  id: 'u1',
  status,
  personId: 'p1',
  person: {
    identification: '1710034065',
    firstName: 'Carlos',
    lastName: 'Pérez',
    email: 'cperez@correo.com',
    phone: '0991111111',
  },
  userRoles: [{ role: { name: 'veterinarian', displayName: 'Veterinario' } }],
});

const input = (overrides: Record<string, unknown> = {}) => ({
  firstName: 'Carlos',
  lastName: 'Pérez',
  email: 'cperez@correo.com',
  phone: '0991111111',
  ...overrides,
});

async function rejection(promise: Promise<unknown>): Promise<ApiException> {
  const error = await promise.catch((cause: unknown) => cause);
  if (error instanceof ApiException) return error;
  throw new Error('Se esperaba un ApiException');
}

describe('UpdateUserService', () => {
  const tx = {
    user: { findUnique: vi.fn() },
    person: { findFirst: vi.fn(), update: vi.fn() },
  };
  const prisma = { $transaction: vi.fn(async (run: (client: typeof tx) => unknown) => run(tx)) };
  const audit = { record: vi.fn(async () => undefined) };
  const mail = { send: vi.fn(async (_message: { to: string; subject: string; text: string }) => undefined) };
  const service = new UpdateUserService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    mail as unknown as MailService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    tx.user.findUnique.mockResolvedValue(storedUser());
    tx.person.findFirst.mockResolvedValue(null);
    tx.person.update.mockResolvedValue({});
    mail.send.mockResolvedValue(undefined);
  });

  it('guarda solo el teléfono cambiado y responde con el mensaje de la HU', async () => {
    const result = await service.update('u1', input({ phone: '0992222222' }), 'admin');

    expect(tx.person.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { phone: '0992222222' } });
    expect(result.message).toBe('Datos actualizados correctamente');
    expect(result.user).toMatchObject({ id: 'u1', phone: '0992222222', status: 'ACTIVE', identification: '1710034065' });
    expect(result.noticeSent).toBeNull();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('audita solo los campos cambiados en el módulo Usuarios', async () => {
    await service.update('u1', input({ phone: '0992222222', lastName: 'Pérez Ruiz' }), 'admin');

    expect(audit.record).toHaveBeenCalledWith(tx, {
      actorId: 'admin',
      action: 'Actualizar',
      module: 'Usuarios',
      affectedRecord: '1710034065 - Carlos Pérez Ruiz',
      previousValue: { lastName: 'Pérez', phone: '0991111111' },
      newValue: { lastName: 'Pérez Ruiz', phone: '0992222222' },
    });
  });

  it('actualiza un usuario inactivo y conserva su estado', async () => {
    tx.user.findUnique.mockResolvedValue(storedUser('INACTIVE'));

    const result = await service.update('u1', input({ phone: '0992222222' }), 'admin');

    expect(result.user.status).toBe('INACTIVE');
  });

  it('ignora la cédula enviada', async () => {
    const result = await service.update('u1', { ...input({ phone: '0992222222' }), identification: '0102030405' }, 'admin');

    expect(tx.person.update.mock.calls[0][0].data).not.toHaveProperty('identification');
    expect(result.user.identification).toBe('1710034065');
  });

  it('guarda el teléfono vacío como null', async () => {
    await service.update('u1', input({ phone: '' }), 'admin');

    expect(tx.person.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { phone: null } });
  });

  it('responde éxito sin escribir, auditar ni avisar cuando nada cambia', async () => {
    const result = await service.update('u1', input({ email: 'CPerez@Correo.com' }), 'admin');

    expect(result.message).toBe('Datos actualizados correctamente');
    expect(tx.person.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('valida antes de abrir la transacción', async () => {
    const error = await rejection(service.update('u1', input({ firstName: '' }), 'admin'));

    expect(error.message).toBe('Complete los campos obligatorios');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('responde 404 si el usuario no existe', async () => {
    tx.user.findUnique.mockResolvedValue(null);

    const error = await rejection(service.update('nadie', input(), 'admin'));

    expect(error.statusCode).toBe(404);
    expect(error.message).toBe('Usuario no encontrado');
  });

  it('rechaza un usuario dado de baja sin cambiar sus datos', async () => {
    tx.user.findUnique.mockResolvedValue(storedUser('DEACTIVATED'));

    const error = await rejection(service.update('u1', input({ phone: '0992222222' }), 'admin'));

    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('USER_DEACTIVATED');
    expect(tx.person.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('rechaza un correo de otra persona sin distinguir mayúsculas', async () => {
    tx.person.findFirst.mockResolvedValue({ id: 'p2' });

    const error = await rejection(service.update('u1', input({ email: 'Ana@Correo.com' }), 'admin'));

    expect(error.statusCode).toBe(409);
    expect(error.message).toBe('El correo ya se encuentra registrado');
    expect(error.errors).toEqual(['email']);
    expect(tx.person.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: 'ana@correo.com', mode: 'insensitive' }, id: { not: 'p1' } },
      select: { id: true },
    });
    expect(audit.record).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('cambia el correo y avisa al correo anterior', async () => {
    const result = await service.update('u1', input({ email: 'carlos.perez@correo.com' }), 'admin');

    expect(tx.person.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { email: 'carlos.perez@correo.com' } });
    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(mail.send.mock.calls[0][0]).toMatchObject({ to: 'cperez@correo.com', subject: 'Su correo de acceso a VetManage cambió' });
    expect(mail.send.mock.calls[0][0].text).toContain('carlos.perez@correo.com');
    expect(result.noticeSent).toBe(true);
    expect(result.message).toBe('Datos actualizados correctamente');
  });

  it('audita el cambio de correo con el valor anterior y el nuevo', async () => {
    await service.update('u1', input({ email: 'carlos.perez@correo.com' }), 'admin');

    expect(audit.record).toHaveBeenCalledWith(tx, expect.objectContaining({
      action: 'Actualizar',
      module: 'Usuarios',
      previousValue: { email: 'cperez@correo.com' },
      newValue: { email: 'carlos.perez@correo.com' },
    }));
  });

  it('conserva el cambio de correo aunque falle el aviso', async () => {
    mail.send.mockRejectedValue(new Error('SMTP caído'));

    const result = await service.update('u1', input({ email: 'carlos.perez@correo.com' }), 'admin');

    expect(result.noticeSent).toBe(false);
    expect(result.message).toBe('Datos actualizados correctamente');
    expect(result.user.email).toBe('carlos.perez@correo.com');
  });

  it('traduce la restricción única de la base a correo repetido', async () => {
    tx.person.update.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));

    const error = await rejection(service.update('u1', input({ email: 'carlos.perez@correo.com' }), 'admin'));

    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('USER_EMAIL_TAKEN');
    expect(mail.send).not.toHaveBeenCalled();
  });
});

describe('UsersController (HU-53)', () => {
  it('exige users:read para consultar y users:update para actualizar', () => {
    expect(Reflect.getMetadata(PERMISSIONS_METADATA, UsersController.prototype.get)).toEqual(['users:read']);
    expect(Reflect.getMetadata(PERMISSIONS_METADATA, UsersController.prototype.update)).toEqual(['users:update']);
  });

  it('delega la actualización con el usuario autenticado y devuelve noticeSent en los datos', async () => {
    const updateUser = { update: vi.fn(async () => ({ message: 'Datos actualizados correctamente', user: { id: 'u1' }, noticeSent: false })) };
    const controller = new UsersController({} as never, {} as never, {} as never, {} as never, {} as never, updateUser as never);

    const response = await controller.update('u1', { phone: '0992222222' }, { user: { id: 'admin' } } as never);

    expect(updateUser.update).toHaveBeenCalledWith('u1', { phone: '0992222222' }, 'admin');
    expect(response).toMatchObject({ success: true, message: 'Datos actualizados correctamente', data: { id: 'u1', noticeSent: false } });
  });
});
