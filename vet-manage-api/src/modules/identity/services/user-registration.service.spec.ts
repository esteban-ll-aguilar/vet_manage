import { Logger } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiException } from '../../../common/errors/api-exception.js';
import { isValidPassword } from '../../../common/security/password-policy.js';
import { UserRegistrationService, USER_MESSAGES } from './user-registration.service.js';

const ROLES = [
  { id: 'r-vet', name: 'veterinarian', displayName: 'Veterinario' },
  { id: 'r-manager', name: 'manager', displayName: 'Gerente' },
  { id: 'r-admin', name: 'administrator', displayName: 'Administrador' },
  { id: 'r-cashier', name: 'cashier', displayName: 'Cajero' },
];

const valid = {
  identification: '1710034065',
  firstName: 'María',
  lastName: 'López',
  email: 'MLopez@Vetmanage.com ',
  phone: '0991234567',
  roles: ['veterinarian'],
};

function build() {
  const tx = {
    person: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    user: { create: vi.fn(), update: vi.fn() },
    userRole: { findMany: vi.fn(async () => []), create: vi.fn(async () => ({})), update: vi.fn(async () => ({})) },
  };
  tx.person.findUnique.mockResolvedValue(null);
  tx.person.findFirst.mockResolvedValue(null);
  tx.person.create.mockImplementation(async ({ data }) => ({ id: 'p1', ...data }));
  tx.user.create.mockImplementation(async ({ data }) => ({ id: 'u1', status: 'ACTIVE', ...data, userRoles: [] }));

  const prisma = {
    role: {
      findMany: vi.fn(async ({ where }: { where: { name?: { in: string[] } } }) =>
        where.name ? ROLES.filter((role) => where.name!.in.includes(role.name) && role.name !== 'client') : ROLES),
    },
    $transaction: vi.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
  };
  const hasher = { hash: vi.fn(async (password: string) => `hash:${password}`) };
  const mail = { send: vi.fn(async () => undefined) };
  const config = { get: vi.fn(() => 'http://localhost:5174') };
  const audit = { record: vi.fn(async () => undefined) };
  const service = new UserRegistrationService(prisma as never, hasher as never, mail as never, config as never, audit as never);
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

describe('UserRegistrationService', () => {
  let ctx: ReturnType<typeof build>;

  beforeEach(() => {
    ctx = build();
  });

  describe('registro exitoso (escenario 1)', () => {
    it('crea persona, cuenta activa con contraseña temporal y rol, y envía las credenciales', async () => {
      const { message, user } = await ctx.service.register(valid, 'admin-1');

      expect(message).toBe(USER_MESSAGES.registered);
      expect(ctx.tx.person.create).toHaveBeenCalledWith({
        data: { identification: '1710034065', firstName: 'María', lastName: 'López', email: 'mlopez@vetmanage.com', phone: '0991234567' },
      });
      const created = ctx.tx.user.create.mock.calls[0][0].data;
      expect(created).toMatchObject({ personId: 'p1', mustChangePassword: true });
      expect(ctx.tx.userRole.create).toHaveBeenCalledWith({ data: { userId: 'u1', roleId: 'r-vet', assignedById: 'admin-1' } });
      expect(user).toMatchObject({ status: 'ACTIVE', existingPerson: false, passwordAssigned: true, credentialsSent: true, roles: [{ name: 'veterinarian', displayName: 'Veterinario' }] });
      expect(user).not.toHaveProperty('password');

      const sent = (ctx.mail.send.mock.calls[0] as unknown as [{ to: string; subject: string; text: string; html: string }])[0];
      expect(sent.subject).toBe('Su cuenta de VetManage está lista');
      expect(sent.text).toContain('Roles: Veterinario');
      expect(sent.html).toContain('href="http://localhost:5174/login"');
      const password = sent.text.match(/Contraseña temporal: (\S+)/)![1];
      expect(isValidPassword(password)).toBe(true);
      expect(created.password).toBe(`hash:${password}`);
      expect(sent.to).toBe('mlopez@vetmanage.com');
      expect(JSON.stringify(user)).not.toContain(password);
    });

    it('acepta el teléfono vacío', async () => {
      await ctx.service.register({ ...valid, phone: '  ' }, 'admin-1');
      expect(ctx.tx.person.create.mock.calls[0][0].data.phone).toBeNull();
    });
  });

  describe('auditoría', () => {
    it('registra la acción en la transacción con el Administrador como actor', async () => {
      await ctx.service.register(valid, 'admin-1');

      expect(ctx.audit.record).toHaveBeenCalledTimes(1);
      expect(ctx.audit.record).toHaveBeenCalledWith(ctx.tx, {
        actorId: 'admin-1',
        action: 'Registrar',
        module: 'Usuarios',
        affectedRecord: '1710034065 - María López',
        newValue: {
          identification: '1710034065',
          firstName: 'María',
          lastName: 'López',
          email: 'mlopez@vetmanage.com',
          roles: ['Veterinario'],
        },
      });
    });

    it('también registra la acción cuando se reutiliza una persona existente', async () => {
      ctx.tx.person.findUnique.mockResolvedValue({
        id: 'p9',
        identification: valid.identification,
        firstName: 'Ana',
        lastName: 'Ruiz',
        email: 'ana@cliente.com',
        phone: null,
        user: { id: 'u9', password: 'hash-actual', status: 'ACTIVE', userRoles: [{ role: { category: 'CLIENT' } }] },
      });

      await ctx.service.register({ ...valid, roles: ['cashier'] }, 'admin-1');

      expect(ctx.audit.record).toHaveBeenCalledWith(
        ctx.tx,
        expect.objectContaining({ module: 'Usuarios', affectedRecord: '1710034065 - Ana Ruiz' }),
      );
    });

    it('no registra nada cuando el registro se rechaza', async () => {
      ctx.tx.person.findUnique.mockResolvedValue({
        id: 'p9',
        identification: valid.identification,
        user: { id: 'u9', password: 'hash', status: 'ACTIVE', userRoles: [{ role: { category: 'STAFF' } }] },
      });

      await rejection(ctx.service.register(valid, 'admin-1'));

      expect(ctx.audit.record).not.toHaveBeenCalled();
    });

    it('falla el registro si no se puede guardar la auditoría', async () => {
      ctx.audit.record.mockRejectedValue(new Error('fallo de auditoría'));

      await expect(ctx.service.register(valid, 'admin-1')).rejects.toThrow('fallo de auditoría');
      expect(ctx.mail.send).not.toHaveBeenCalled();
    });
  });

  it('asigna varios roles a una sola cuenta (escenario 2)', async () => {
    await ctx.service.register({ ...valid, roles: ['manager', 'administrator', 'manager'] }, 'admin-1');

    expect(ctx.tx.user.create).toHaveBeenCalledTimes(1);
    expect(ctx.tx.userRole.create).toHaveBeenCalledTimes(2);
  });

  describe('persona existente (escenario 3)', () => {
    const client = (overrides: Record<string, unknown> = {}) => ({
      id: 'p9',
      identification: valid.identification,
      firstName: 'Ana',
      lastName: 'Ruiz',
      email: 'ana@cliente.com',
      phone: null,
      user: { id: 'u9', password: 'hash-actual', status: 'ACTIVE', userRoles: [{ role: { category: 'CLIENT' } }] },
      ...overrides,
    });

    it('reutiliza a la persona, conserva la contraseña y no envía correo', async () => {
      ctx.tx.person.findUnique.mockResolvedValue(client());

      const { message, user } = await ctx.service.register({ ...valid, roles: ['cashier'] }, 'admin-1');

      expect(ctx.tx.person.create).not.toHaveBeenCalled();
      expect(ctx.tx.user.create).not.toHaveBeenCalled();
      expect(ctx.tx.user.update).not.toHaveBeenCalled();
      expect(ctx.tx.userRole.create).toHaveBeenCalledWith({ data: { userId: 'u9', roleId: 'r-cashier', assignedById: 'admin-1' } });
      expect(ctx.mail.send).not.toHaveBeenCalled();
      expect(message).toBe(USER_MESSAGES.registered);
      expect(user).toMatchObject({ existingPerson: true, passwordAssigned: false, credentialsSent: false, email: 'ana@cliente.com' });
    });

    it('crea la cuenta y envía las credenciales al correo guardado cuando la persona no tiene cuenta', async () => {
      ctx.tx.person.findUnique.mockResolvedValue(client({ user: null }));

      await ctx.service.register({ ...valid, roles: ['cashier'] }, 'admin-1');

      expect(ctx.tx.user.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ personId: 'p9', mustChangePassword: true }) }));
      expect((ctx.mail.send.mock.calls[0] as unknown as [{ to: string }])[0].to).toBe('ana@cliente.com');
    });

    it('asigna una contraseña temporal a una cuenta sin contraseña', async () => {
      ctx.tx.person.findUnique.mockResolvedValue(client({ user: { id: 'u9', password: null, status: 'ACTIVE', userRoles: [] } }));
      ctx.tx.user.update.mockImplementation(async ({ data }) => ({ id: 'u9', status: 'ACTIVE', ...data, userRoles: [] }));

      await ctx.service.register({ ...valid, roles: ['cashier'] }, 'admin-1');

      expect(ctx.tx.user.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'u9' }, data: expect.objectContaining({ mustChangePassword: true }) }));
      expect(ctx.mail.send).toHaveBeenCalledTimes(1);
    });

    it('renueva un rol vencido y no duplica uno vigente', async () => {
      ctx.tx.person.findUnique.mockResolvedValue(client());
      ctx.tx.userRole.findMany.mockResolvedValue([
        { id: 'ur1', roleId: 'r-cashier', expiresAt: new Date(Date.now() - 1000) },
        { id: 'ur2', roleId: 'r-vet', expiresAt: null },
      ] as never);

      await ctx.service.register({ ...valid, roles: ['cashier', 'veterinarian'] }, 'admin-1');

      expect(ctx.tx.userRole.update).toHaveBeenCalledWith({ where: { id: 'ur1' }, data: { expiresAt: null, assignedById: 'admin-1' } });
      expect(ctx.tx.userRole.create).not.toHaveBeenCalled();
    });
  });

  describe('campos obligatorios (escenario 4)', () => {
    it.each([
      ['email', { email: '  ' }],
      ['identification', { identification: undefined }],
      ['firstName', { firstName: '' }],
      ['lastName', { lastName: undefined }],
      ['roles', { roles: [] }],
    ])('rechaza si falta %s', async (field, override) => {
      const error = await rejection(ctx.service.register({ ...valid, ...override }, 'admin-1'));

      expect(error).toMatchObject({ statusCode: 400, message: 'Complete los campos obligatorios', code: 'USER_MISSING_FIELDS', errors: [field] });
      expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
      expect(ctx.mail.send).not.toHaveBeenCalled();
    });

    it('lista todos los campos faltantes', async () => {
      const error = await rejection(ctx.service.register({}, 'admin-1'));
      expect(error.errors).toEqual(['identification', 'firstName', 'lastName', 'email', 'roles']);
    });
  });

  it('rechaza la cédula del personal ya registrada (escenario 5)', async () => {
    ctx.tx.person.findUnique.mockResolvedValue({
      id: 'p2', identification: valid.identification,
      user: { id: 'u2', password: 'h', userRoles: [{ role: { category: 'STAFF' } }] },
    });

    const error = await rejection(ctx.service.register(valid, 'admin-1'));

    expect(error).toMatchObject({ statusCode: 409, message: 'Número de cédula ya registrado', code: 'USER_IDENTIFICATION_TAKEN' });
    expect(ctx.tx.userRole.create).not.toHaveBeenCalled();
  });

  it('rechaza la cédula con formato inválido (escenario 6)', async () => {
    const error = await rejection(ctx.service.register({ ...valid, identification: '11045' }, 'admin-1'));

    expect(error).toMatchObject({ statusCode: 400, message: 'La cédula debe tener 10 dígitos válidos', code: 'USER_INVALID_IDENTIFICATION' });
  });

  it('rechaza el correo ya registrado (escenario 7)', async () => {
    ctx.tx.person.findFirst.mockResolvedValue({ id: 'otra' });

    const error = await rejection(ctx.service.register({ ...valid, email: 'MLopez@vetmanage.com' }, 'admin-1'));

    expect(error).toMatchObject({ statusCode: 409, message: 'El correo ya se encuentra registrado', code: 'USER_EMAIL_TAKEN' });
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

  it('mantiene la cuenta si falla el envío del correo (escenario 8)', async () => {
    ctx.mail.send.mockRejectedValue(new Error('SMTP caído'));

    const { message, user } = await ctx.service.register(valid, 'admin-1');

    expect(message).toBe(USER_MESSAGES.mailFailed);
    expect(user).toMatchObject({ passwordAssigned: true, credentialsSent: false });
    expect(ctx.tx.user.create).toHaveBeenCalledTimes(1);
  });

  describe('formatos', () => {
    it.each([
      ['correo', { email: 'ana@' }, 'Ingrese un correo electrónico válido', 'USER_INVALID_EMAIL'],
      ['teléfono', { phone: '12ab' }, 'Ingrese un teléfono válido', 'USER_INVALID_PHONE'],
      ['nombre', { firstName: 'x'.repeat(101) }, 'Los nombres y apellidos no pueden superar 100 caracteres', 'USER_INVALID_NAME'],
    ])('rechaza %s inválido', async (_name, override, message, code) => {
      const error = await rejection(ctx.service.register({ ...valid, ...override }, 'admin-1'));
      expect(error).toMatchObject({ statusCode: 400, message, code });
    });
  });

  describe('roles', () => {
    it.each([['client'], ['inexistente']])('rechaza el rol %s', async (role) => {
      const error = await rejection(ctx.service.register({ ...valid, roles: ['veterinarian', role] }, 'admin-1'));

      expect(error).toMatchObject({ statusCode: 400, message: 'Seleccione roles válidos del personal', code: 'USER_INVALID_ROLES' });
    });

    it('busca solo roles activos del personal', async () => {
      await ctx.service.register(valid, 'admin-1');

      expect(ctx.prisma.role.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { name: { in: ['veterinarian'] }, isActive: true, category: 'STAFF' } }));
    });

    it('lista los roles asignables ordenados', async () => {
      await ctx.service.listAssignableRoles();

      expect(ctx.prisma.role.findMany).toHaveBeenCalledWith({
        where: { isActive: true, category: 'STAFF' },
        select: { name: true, displayName: true, description: true },
        orderBy: { displayName: 'asc' },
      });
    });
  });

  describe('carrera entre registros iguales', () => {
    it.each([
      [{ target: ['email'] }, 'USER_EMAIL_TAKEN'],
      [{ target: ['identification'] }, 'USER_IDENTIFICATION_TAKEN'],
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
