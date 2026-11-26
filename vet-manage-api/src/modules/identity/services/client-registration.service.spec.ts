import { Logger } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiException } from '../../../common/errors/api-exception.js';
import { isValidPassword } from '../../../common/security/password-policy.js';
import type { ClientRegistrationDto } from '../dtos/client-registration.dto.js';
import { ClientRegistrationService, CLIENT_MESSAGES } from './client-registration.service.js';

const CLIENT_ROLE = { id: 'r-client', name: 'client', displayName: 'Cliente' };

const valid = {
  identification: '1710034065',
  firstName: 'María',
  lastName: 'López',
  email: 'MLopez@Vetmanage.com ',
  phone: '0991234567',
  address: 'Av. Principal 123',
};

function build() {
  const tx = {
    person: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    user: { create: vi.fn(), update: vi.fn() },
    userRole: { findMany: vi.fn(async () => []), create: vi.fn(async () => ({})), update: vi.fn(async () => ({})) },
    client: {
      upsert: vi.fn(async ({ where }: { where: { personId: string } }) => ({
        id: 'c1',
        personId: where.personId,
        status: 'ACTIVE',
      })),
    },
    patient: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  };
  tx.person.findUnique.mockResolvedValue(null);
  tx.person.findFirst.mockResolvedValue(null);
  tx.person.create.mockImplementation(async ({ data }) => ({ id: 'p1', ...data }));
  tx.person.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'p9',
    identification: valid.identification,
    firstName: 'Ana',
    lastName: 'Ruiz',
    email: 'ana@cliente.com',
    phone: null,
    address: null,
    ...data,
  }));
  tx.user.create.mockImplementation(async ({ data }) => ({ id: 'u1', status: 'ACTIVE', ...data, userRoles: [] }));

  const prisma = {
    role: {
      findFirst: vi.fn(async (): Promise<typeof CLIENT_ROLE | null> => CLIENT_ROLE),
      findMany: vi.fn(async () => [CLIENT_ROLE]),
    },
    $transaction: vi.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
  };
  const hasher = { hash: vi.fn(async (password: string) => `hash:${password}`) };
  const mail = { send: vi.fn(async () => undefined) };
  const config = { get: vi.fn(() => 'http://localhost:5174') };
  const audit = { record: vi.fn(async () => undefined) };
  const service = new ClientRegistrationService(prisma as never, hasher as never, mail as never, config as never, audit as never);
  return { service, tx, prisma, hasher, mail, audit };
}

async function rejection(promise: Promise<unknown>): Promise<ApiException> {
  try {
    await promise;
  } catch (error) {
    return error as ApiException;
  }
  throw new Error('Se esperaba un rechazo');
}

describe('ClientRegistrationService', () => {
  let ctx: ReturnType<typeof build>;

  beforeEach(() => {
    ctx = build();
  });

  describe('registro exitoso de cliente', () => {
    it('crea persona, cuenta, registro Client y rol client, y envía las credenciales', async () => {
      const { message, client } = await ctx.service.register(valid, 'admin-1');

      expect(message).toBe(CLIENT_MESSAGES.registered);
      expect(ctx.tx.person.create).toHaveBeenCalledWith({
        data: {
          identification: '1710034065',
          firstName: 'María',
          lastName: 'López',
          email: 'mlopez@vetmanage.com',
          phone: '0991234567',
          address: 'Av. Principal 123',
        },
      });
      const created = ctx.tx.user.create.mock.calls[0][0].data;
      expect(created).toMatchObject({ personId: 'p1', mustChangePassword: true });
      expect(ctx.tx.userRole.create).toHaveBeenCalledWith({ data: { userId: 'u1', roleId: 'r-client', assignedById: 'admin-1' } });
      expect(ctx.tx.client.upsert).toHaveBeenCalledWith({
        where: { personId: 'p1' },
        create: { personId: 'p1', status: 'ACTIVE' },
        update: {},
      });
      expect(client).toMatchObject({
        id: 'c1',
        personId: 'p1',
        status: 'ACTIVE',
        existingPerson: false,
        passwordAssigned: true,
        credentialsSent: true,
        address: 'Av. Principal 123',
        roles: [{ name: 'client', displayName: 'Cliente' }],
      });
      expect(client).not.toHaveProperty('password');

      const sent = (ctx.mail.send.mock.calls[0] as unknown as [{ to: string; subject: string; text: string; html: string }])[0];
      expect(sent.subject).toBe('Su cuenta de VetManage está lista');
      expect(sent.text).toContain('Roles: Cliente');
      expect(sent.html).toContain('href="http://localhost:5174/login"');
      const password = sent.text.match(/Contraseña temporal: (\S+)/)![1];
      expect(isValidPassword(password)).toBe(true);
      expect(created.password).toBe(`hash:${password}`);
      expect(sent.to).toBe('mlopez@vetmanage.com');
      expect(JSON.stringify(client)).not.toContain(password);
    });

    it('rechaza el teléfono vacío como campo obligatorio', async () => {
      const error = await rejection(ctx.service.register({ ...valid, phone: '  ' }, 'admin-1'));

      expect(error).toMatchObject({
        statusCode: 400,
        message: 'Por favor, complete todos los campos obligatorios',
        code: 'CLIENT_MISSING_FIELDS',
        errors: ['phone'],
      });
      expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
    });

    it('acepta la dirección vacía', async () => {
      await ctx.service.register({ ...valid, address: '  ' }, 'admin-1');
      expect(ctx.tx.person.create.mock.calls[0][0].data.address).toBeNull();
    });

    it('ignora roles heredados y asigna siempre el rol client', async () => {
      await ctx.service.register({ ...valid, roles: ['veterinarian', 'manager'] }, 'admin-1');

      expect(ctx.tx.userRole.create).toHaveBeenCalledTimes(1);
      expect(ctx.tx.userRole.create).toHaveBeenCalledWith({ data: { userId: 'u1', roleId: 'r-client', assignedById: 'admin-1' } });
    });
  });

  describe('persona existente', () => {
    const client = (overrides: Record<string, unknown> = {}) => ({
      id: 'p9',
      identification: valid.identification,
      firstName: 'Ana',
      lastName: 'Ruiz',
      email: 'ana@cliente.com',
      phone: null,
      address: null,
      client: null,
      user: { id: 'u9', password: 'hash-actual', status: 'ACTIVE', userRoles: [{ role: { category: 'CLIENT' } }] },
      ...overrides,
    });

    it('reutiliza la persona, conserva la contraseña y no envía correo', async () => {
      ctx.tx.person.findUnique.mockResolvedValue(client());
      ctx.tx.userRole.findMany.mockResolvedValue([
        { id: 'ur9', roleId: 'r-client', expiresAt: null },
      ] as never);

      const { message, client: result } = await ctx.service.register(valid, 'admin-1');

      expect(ctx.tx.person.create).not.toHaveBeenCalled();
      expect(ctx.tx.user.create).not.toHaveBeenCalled();
      expect(ctx.tx.user.update).not.toHaveBeenCalled();
      expect(ctx.tx.userRole.create).not.toHaveBeenCalled();
      expect(ctx.tx.client.upsert).toHaveBeenCalledWith({
        where: { personId: 'p9' },
        create: { personId: 'p9', status: 'ACTIVE' },
        update: {},
      });
      expect(ctx.mail.send).not.toHaveBeenCalled();
      expect(message).toBe(CLIENT_MESSAGES.registered);
      expect(result).toMatchObject({ existingPerson: true, passwordAssigned: false, credentialsSent: false, email: 'ana@cliente.com' });
    });

    it('registra como cliente a un personal sin cliente reutilizando su persona y cuenta', async () => {
      const foundPerson = client({ client: null, user: { id: 'u9', password: 'hash-actual' } });
      ctx.tx.person.findUnique.mockResolvedValue(foundPerson);
      ctx.tx.person.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...foundPerson, ...data }));

      const { message, client: result } = await ctx.service.register(valid, 'admin-1');

      expect(ctx.tx.person.create).not.toHaveBeenCalled();
      expect(ctx.tx.user.create).not.toHaveBeenCalled();
      expect(ctx.tx.user.update).not.toHaveBeenCalled();
      expect(ctx.tx.person.update).toHaveBeenCalledWith({ where: { id: 'p9' }, data: { address: 'Av. Principal 123' } });
      expect(ctx.tx.userRole.create).toHaveBeenCalledWith({ data: { userId: 'u9', roleId: 'r-client', assignedById: 'admin-1' } });
      expect(ctx.tx.client.upsert).toHaveBeenCalledWith({
        where: { personId: 'p9' },
        create: { personId: 'p9', status: 'ACTIVE' },
        update: {},
      });
      expect(ctx.mail.send).not.toHaveBeenCalled();
      expect(message).toBe(CLIENT_MESSAGES.registered);
      expect(result).toMatchObject({
        existingPerson: true,
        passwordAssigned: false,
        credentialsSent: false,
        firstName: 'Ana',
        lastName: 'Ruiz',
        email: 'ana@cliente.com',
        phone: null,
        address: 'Av. Principal 123',
      });
      expect(foundPerson.firstName).toBe('Ana');
      expect(foundPerson.email).toBe('ana@cliente.com');
    });

    it('no sobrescribe una dirección existente al reutilizar la persona', async () => {
      ctx.tx.person.findUnique.mockResolvedValue(client({ client: null, address: 'Dirección previa' }));

      await ctx.service.register(valid, 'admin-1');

      expect(ctx.tx.person.update).not.toHaveBeenCalled();
    });

    it('crea la cuenta y envía las credenciales al correo guardado cuando la persona no tiene cuenta', async () => {
      ctx.tx.person.findUnique.mockResolvedValue(client({ user: null }));

      await ctx.service.register(valid, 'admin-1');

      expect(ctx.tx.user.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ personId: 'p9', mustChangePassword: true }) }));
      expect((ctx.mail.send.mock.calls[0] as unknown as [{ to: string }])[0].to).toBe('ana@cliente.com');
      expect(ctx.tx.client.upsert).toHaveBeenCalledWith({
        where: { personId: 'p9' },
        create: { personId: 'p9', status: 'ACTIVE' },
        update: {},
      });
    });

    it('asigna una contraseña temporal a una cuenta sin contraseña', async () => {
      ctx.tx.person.findUnique.mockResolvedValue(client({ user: { id: 'u9', password: null, status: 'ACTIVE', userRoles: [] } }));
      ctx.tx.user.update.mockImplementation(async ({ data }) => ({ id: 'u9', status: 'ACTIVE', ...data, userRoles: [] }));

      await ctx.service.register(valid, 'admin-1');

      expect(ctx.tx.user.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'u9' }, data: expect.objectContaining({ mustChangePassword: true }) }));
      expect(ctx.mail.send).toHaveBeenCalledTimes(1);
    });

    it('renueva el rol client vencido y no duplica uno vigente', async () => {
      ctx.tx.person.findUnique.mockResolvedValue(client());
      ctx.tx.userRole.findMany.mockResolvedValue([
        { id: 'ur1', roleId: 'r-client', expiresAt: new Date(Date.now() - 1000) },
      ] as never);

      await ctx.service.register(valid, 'admin-1');

      expect(ctx.tx.userRole.update).toHaveBeenCalledWith({ where: { id: 'ur1' }, data: { expiresAt: null, assignedById: 'admin-1' } });
      expect(ctx.tx.userRole.create).not.toHaveBeenCalled();
    });
  });

  describe('campos obligatorios', () => {
    it.each([
      ['email', { email: '  ' }],
      ['identification', { identification: undefined }],
      ['firstName', { firstName: '' }],
      ['lastName', { lastName: undefined }],
      ['phone', { phone: '  ' }],
    ])('rechaza si falta %s', async (field, override) => {
      const error = await rejection(ctx.service.register({ ...valid, ...override } as ClientRegistrationDto, 'admin-1'));

      expect(error).toMatchObject({
        statusCode: 400,
        message: 'Por favor, complete todos los campos obligatorios',
        code: 'CLIENT_MISSING_FIELDS',
        errors: [field],
      });
      expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
      expect(ctx.mail.send).not.toHaveBeenCalled();
    });

    it('lista todos los campos faltantes, incluido el teléfono', async () => {
      const error = await rejection(ctx.service.register({} as ClientRegistrationDto, 'admin-1'));
      expect(error.errors).toEqual(['identification', 'firstName', 'lastName', 'email', 'phone']);
    });
  });

  describe('auditoría', () => {
    it('registra la acción en la transacción con el usuario autenticado como actor', async () => {
      await ctx.service.register(valid, 'recep-1');

      expect(ctx.audit.record).toHaveBeenCalledTimes(1);
      expect(ctx.audit.record).toHaveBeenCalledWith(ctx.tx, {
        actorId: 'recep-1',
        action: 'Registrar',
        module: 'Clientes',
        affectedRecord: `${valid.identification} - ${valid.firstName} ${valid.lastName}`,
      });
    });

    it('no registra nada cuando el registro se rechaza', async () => {
      await rejection(ctx.service.register({ ...valid, identification: '11045' }, 'recep-1'));

      expect(ctx.audit.record).not.toHaveBeenCalled();
    });

    it('falla el registro si no se puede guardar la auditoría', async () => {
      ctx.audit.record.mockRejectedValue(new Error('fallo de auditoría'));

      await expect(ctx.service.register(valid, 'recep-1')).rejects.toThrow('fallo de auditoría');
    });
  });

  it.each(['ACTIVE', 'INACTIVE', 'DEACTIVATED'] as const)(
    'rechaza la cédula de un cliente ya registrado con estado %s sin tocar sus pacientes',
    async (status) => {
      const patients = [{ id: 'pet-1', name: 'Firulais' }];
      const existing = {
        id: 'p2',
        identification: valid.identification,
        client: { id: 'c-viejo', status },
        patients,
        user: { id: 'u2', password: 'h', userRoles: [{ role: { category: 'STAFF' } }] },
      };
      ctx.tx.person.findUnique.mockResolvedValue(existing);

      const error = await rejection(ctx.service.register(valid, 'admin-1'));

      expect(error).toMatchObject({
        statusCode: 409,
        message: 'Número de cédula ya registrado',
        code: 'CLIENT_IDENTIFICATION_TAKEN',
      });
      expect(ctx.tx.userRole.create).not.toHaveBeenCalled();
      expect(ctx.tx.client.upsert).not.toHaveBeenCalled();
      expect(ctx.tx.patient.create).not.toHaveBeenCalled();
      expect(ctx.tx.patient.update).not.toHaveBeenCalled();
      expect(ctx.tx.patient.delete).not.toHaveBeenCalled();
      expect(ctx.tx.patient.deleteMany).not.toHaveBeenCalled();
      expect(existing.client.id).toBe('c-viejo');
      expect(existing.patients).toBe(patients);
      expect(existing.patients[0]).toBe(patients[0]);
    },
  );

  it('rechaza la cédula con formato inválido', async () => {
    const error = await rejection(ctx.service.register({ ...valid, identification: '11045' }, 'admin-1'));

    expect(error).toMatchObject({ statusCode: 400, message: 'Número de cédula no válido', code: 'CLIENT_INVALID_IDENTIFICATION' });
  });

  it('rechaza el correo ya registrado', async () => {
    ctx.tx.person.findFirst.mockResolvedValue({ id: 'otra' });

    const error = await rejection(ctx.service.register({ ...valid, email: 'MLopez@vetmanage.com' }, 'admin-1'));

    expect(error).toMatchObject({ statusCode: 409, message: 'El correo ya se encuentra registrado', code: 'CLIENT_EMAIL_TAKEN' });
    expect(ctx.tx.person.create).not.toHaveBeenCalled();
    expect(ctx.tx.person.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { email: { equals: 'mlopez@vetmanage.com', mode: 'insensitive' } } }));
  });

  it('no registra la contraseña temporal en los logs cuando falla el correo', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    ctx.mail.send.mockRejectedValue(new Error('SMTP caído'));

    await ctx.service.register(valid, 'admin-1');

    const password = ctx.tx.user.create.mock.calls[0][0].data.password.replace('hash:', '');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).not.toContain(password);
    expect(String(warn.mock.calls[0][0])).toContain('u1');
    warn.mockRestore();
  });

  it('mantiene la cuenta si falla el envío del correo', async () => {
    ctx.mail.send.mockRejectedValue(new Error('SMTP caído'));

    const { message, client } = await ctx.service.register(valid, 'admin-1');

    expect(message).toBe(CLIENT_MESSAGES.mailFailed);
    expect(client).toMatchObject({ passwordAssigned: true, credentialsSent: false });
    expect(ctx.tx.user.create).toHaveBeenCalledTimes(1);
    expect(ctx.tx.client.upsert).toHaveBeenCalledTimes(1);
  });

  describe('formatos', () => {
    it.each([
      ['correo', { email: 'ana@' }, 'CLIENT_INVALID_EMAIL', ['email']],
      ['teléfono alfabético', { phone: '12ab' }, 'CLIENT_INVALID_PHONE', ['phone']],
      ['teléfono de 9 dígitos', { phone: '099123456' }, 'CLIENT_INVALID_PHONE', ['phone']],
      ['teléfono de 11 dígitos', { phone: '09912345678' }, 'CLIENT_INVALID_PHONE', ['phone']],
      ['teléfono con prefijo distinto de 09', { phone: '0123456789' }, 'CLIENT_INVALID_PHONE', ['phone']],
      ['teléfono con prefijo internacional', { phone: '+593991234567' }, 'CLIENT_INVALID_PHONE', ['phone']],
      ['nombre', { firstName: 'x'.repeat(101) }, 'CLIENT_INVALID_NAME', ['firstName', 'lastName']],
      ['dirección', { address: 'x'.repeat(256) }, 'CLIENT_INVALID_ADDRESS', ['address']],
    ])('rechaza %s', async (_name, override, code, fields) => {
      const error = await rejection(ctx.service.register({ ...valid, ...override }, 'admin-1'));

      const message = code === 'CLIENT_INVALID_EMAIL' || code === 'CLIENT_INVALID_PHONE'
        ? 'Por favor, ingrese un correo y número de teléfono válido'
        : code === 'CLIENT_INVALID_NAME'
          ? 'Los nombres y apellidos no pueden superar 100 caracteres'
          : 'Dirección no válida';
      expect(error).toMatchObject({ statusCode: 400, message, code, errors: fields });
      expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
    });

    it('acepta un teléfono de 10 dígitos con prefijo 09', async () => {
      await ctx.service.register({ ...valid, phone: '0999999999' }, 'admin-1');

      expect(ctx.tx.person.create.mock.calls[0][0].data.phone).toBe('0999999999');
    });
  });

  describe('rol client', () => {
    it('busca el rol activo de la categoría CLIENT', async () => {
      await ctx.service.register(valid, 'admin-1');

      expect(ctx.prisma.role.findFirst).toHaveBeenCalledWith({
        where: { name: 'client', isActive: true, category: 'CLIENT' },
        select: { id: true, name: true, displayName: true },
      });
    });

    it('falla con error 500 si no existe el rol client activo', async () => {
      ctx.prisma.role.findFirst.mockResolvedValue(null);

      const error = await rejection(ctx.service.register(valid, 'admin-1'));

      expect(error).toMatchObject({
        statusCode: 500,
        message: 'No se encontró el rol de cliente activo',
        code: 'CLIENT_ROLE_MISSING',
      });
      expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
    });

    it('lista los roles asignables ordenados', async () => {
      await ctx.service.listAssignableRoles();

      expect(ctx.prisma.role.findMany).toHaveBeenCalledWith({
        where: { isActive: true, category: 'CLIENT' },
        select: { name: true, displayName: true, description: true },
        orderBy: { displayName: 'asc' },
      });
    });
  });

  describe('carrera entre registros iguales', () => {
    it.each([
      [{ target: ['email'] }, 'CLIENT_EMAIL_TAKEN'],
      [{ target: ['identification'] }, 'CLIENT_IDENTIFICATION_TAKEN'],
    ])('traduce la violación de unicidad %j', async (meta, code) => {
      ctx.prisma.$transaction.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002', meta }));

      const error = await rejection(ctx.service.register(valid, 'admin-1'));

      expect(error).toMatchObject({ statusCode: 409, code });
    });

    it('no oculta otros errores', async () => {
      ctx.prisma.$transaction.mockRejectedValue(new Error('base caída'));

      await expect(ctx.service.register(valid, 'admin-1')).rejects.toThrow('base caída');
    });
  });
});
