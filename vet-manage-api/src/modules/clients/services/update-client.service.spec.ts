import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiException } from '../../../common/errors/api-exception.js';
import { CLIENT_MESSAGES } from '../../identity/services/client-registration.service.js';
import { CLIENT_UPDATE_MESSAGES, UpdateClientService } from './update-client.service.js';

const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const PERSON_ID = '22222222-2222-4222-8222-222222222222';

type Category = 'CLIENT' | 'STAFF' | 'SYSTEM';

const person = (categories: Category[] = ['CLIENT']) => ({
  id: PERSON_ID,
  identification: '1710034065',
  firstName: 'Carlos',
  lastName: 'Pérez',
  email: 'cperez@correo.com',
  phone: '0991111111',
  address: 'Av. Amazonas 123',
  user: { userRoles: categories.map((category) => ({ role: { category } })) },
});

const record = (status = 'ACTIVE', categories?: Category[]) => ({ id: CLIENT_ID, status, person: person(categories) });

const input = (overrides: Record<string, unknown> = {}) => ({
  firstName: 'Carlos',
  lastName: 'Pérez',
  email: 'cperez@correo.com',
  phone: '0991111111',
  address: 'Av. Amazonas 123',
  ...overrides,
});

function build(found: unknown = record()) {
  const tx = {
    client: { findUnique: vi.fn(async () => found) },
    person: {
      findFirst: vi.fn(async (): Promise<{ id: string } | null> => null),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...person(), ...data })),
    },
  };
  const prisma = { $transaction: vi.fn(async (run: (client: typeof tx) => unknown) => run(tx)) };
  const audit = { record: vi.fn(async () => undefined) };
  const service = new UpdateClientService(prisma as never, audit as never);
  return { tx, prisma, audit, service };
}

async function rejection(promise: Promise<unknown>): Promise<ApiException> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiException) return error;
    throw error;
  }
  throw new Error('Se esperaba un rechazo');
}

describe('UpdateClientService', () => {
  let ctx: ReturnType<typeof build>;

  beforeEach(() => {
    ctx = build();
  });

  it('guarda solo el campo cambiado y devuelve el cliente actualizado', async () => {
    const result = await ctx.service.update(CLIENT_ID, input({ phone: '0992222222' }), 'actor-1');

    expect(ctx.tx.person.update).toHaveBeenCalledWith({ where: { id: PERSON_ID }, data: { phone: '0992222222' } });
    expect(result).toEqual({
      message: CLIENT_UPDATE_MESSAGES.updated,
      client: {
        id: CLIENT_ID,
        identification: '1710034065',
        firstName: 'Carlos',
        lastName: 'Pérez',
        email: 'cperez@correo.com',
        phone: '0992222222',
        address: 'Av. Amazonas 123',
        status: 'ACTIVE',
      },
    });
  });

  it('audita solo los campos cambiados dentro de la transacción', async () => {
    await ctx.service.update(CLIENT_ID, input({ phone: '0992222222', address: '' }), 'actor-1');

    expect(ctx.audit.record).toHaveBeenCalledWith(ctx.tx, {
      actorId: 'actor-1',
      action: 'Actualizar',
      module: 'Clientes',
      affectedRecord: '1710034065 - Carlos Pérez',
      previousValue: { phone: '0991111111', address: 'Av. Amazonas 123' },
      newValue: { phone: '0992222222', address: null },
    });
  });

  it('actualiza un cliente inactivo y conserva su estado', async () => {
    ctx = build(record('INACTIVE'));

    const result = await ctx.service.update(CLIENT_ID, input({ firstName: 'Carlos Andrés' }), 'actor-1');

    expect(result.client).toMatchObject({ firstName: 'Carlos Andrés', status: 'INACTIVE' });
  });

  it('ignora la cédula enviada', async () => {
    await ctx.service.update(CLIENT_ID, input({ identification: '0102030405', phone: '0992222222' }), 'actor-1');

    expect(ctx.tx.person.update).toHaveBeenCalledWith({ where: { id: PERSON_ID }, data: { phone: '0992222222' } });
  });

  it('responde éxito sin escribir ni auditar cuando nada cambia', async () => {
    const result = await ctx.service.update(CLIENT_ID, input({ email: 'CPerez@Correo.com' }), 'actor-1');

    expect(result.message).toBe(CLIENT_UPDATE_MESSAGES.updated);
    expect(ctx.tx.person.update).not.toHaveBeenCalled();
    expect(ctx.audit.record).not.toHaveBeenCalled();
  });

  it('valida antes de abrir la transacción', async () => {
    const error = await rejection(ctx.service.update(CLIENT_ID, input({ firstName: '' }), 'actor-1'));

    expect(error.message).toBe(CLIENT_MESSAGES.missing);
    expect(error.errors).toEqual(['firstName']);
    expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('responde 404 si el cliente no existe', async () => {
    ctx = build(null);

    const error = await rejection(ctx.service.update(CLIENT_ID, input(), 'actor-1'));

    expect(error.statusCode).toBe(404);
    expect(error.message).toBe(CLIENT_UPDATE_MESSAGES.notFound);
  });

  it('rechaza un cliente dado de baja', async () => {
    ctx = build(record('DEACTIVATED'));

    const error = await rejection(ctx.service.update(CLIENT_ID, input({ phone: '0992222222' }), 'actor-1'));

    expect(error).toMatchObject({ statusCode: 409, code: 'CLIENT_DEACTIVATED', message: CLIENT_UPDATE_MESSAGES.deactivated });
    expect(ctx.tx.person.update).not.toHaveBeenCalled();
  });

  it('rechaza un correo que ya usa otra persona, sin distinguir mayúsculas', async () => {
    ctx.tx.person.findFirst.mockResolvedValueOnce({ id: 'otra-persona' });

    const error = await rejection(ctx.service.update(CLIENT_ID, input({ email: 'Ana@Correo.com' }), 'actor-1'));

    expect(error).toMatchObject({ statusCode: 409, code: 'CLIENT_EMAIL_TAKEN', message: CLIENT_MESSAGES.emailTaken, errors: ['email'] });
    expect(ctx.tx.person.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: 'ana@correo.com', mode: 'insensitive' }, id: { not: PERSON_ID } },
      select: { id: true },
    });
    expect(ctx.audit.record).not.toHaveBeenCalled();
  });

  it.each([['STAFF'], ['SYSTEM']] as const)('no cambia el correo de un cliente con rol %s', async (category) => {
    ctx = build(record('ACTIVE', ['CLIENT', category]));

    const error = await rejection(ctx.service.update(CLIENT_ID, input({ email: 'nuevo@correo.com' }), 'actor-1'));

    expect(error).toMatchObject({ statusCode: 409, code: 'CLIENT_EMAIL_LOCKED', message: CLIENT_UPDATE_MESSAGES.emailLocked, errors: ['email'] });
    expect(ctx.tx.person.update).not.toHaveBeenCalled();
  });

  it('cambia el teléfono de un cliente del personal si conserva su correo', async () => {
    ctx = build(record('ACTIVE', ['CLIENT', 'STAFF']));

    const result = await ctx.service.update(CLIENT_ID, input({ phone: '0992222222' }), 'actor-1');

    expect(result.client.phone).toBe('0992222222');
  });

  it('cambia el correo de un cliente sin cuenta del personal', async () => {
    const result = await ctx.service.update(CLIENT_ID, input({ email: 'carlos.perez@correo.com' }), 'actor-1');

    expect(result.client.email).toBe('carlos.perez@correo.com');
  });

  it('traduce la restricción única de la base a correo repetido', async () => {
    ctx.tx.person.update.mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002' }));

    const error = await rejection(ctx.service.update(CLIENT_ID, input({ email: 'ana@correo.com' }), 'actor-1'));

    expect(error).toMatchObject({ statusCode: 409, code: 'CLIENT_EMAIL_TAKEN' });
  });
});
