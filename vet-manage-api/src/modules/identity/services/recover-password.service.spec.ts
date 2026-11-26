import { Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiException } from '../../../common/errors/api-exception.js';
import { PASSWORD_RESET_MESSAGES, RecoverPasswordService } from './recover-password.service.js';

const START = new Date('2026-11-24T15:00:00.000Z');
const MINUTE = 60_000;
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

type Account = {
  id: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DEACTIVATED';
  person: { identification: string; firstName: string; lastName: string; email: string };
};

type Row = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  replacedAt: Date | null;
};

// Repositorio en memoria con el mismo comportamiento que PasswordResetTokenRepository.
function fakeRepository(accounts: Account[]) {
  const rows: Row[] = [];
  return {
    rows,
    replaceActive: vi.fn(async (_tx: unknown, userId: string, now: Date) => {
      for (const row of rows) if (row.userId === userId && !row.usedAt && !row.replacedAt) row.replacedAt = now;
    }),
    create: vi.fn(async (_tx: unknown, data: { userId: string; tokenHash: string; expiresAt: Date }) => {
      rows.push({ id: `t-${rows.length + 1}`, ...data, usedAt: null, replacedAt: null });
    }),
    findByHash: vi.fn(async (_tx: unknown, tokenHash: string) => {
      const row = rows.find((item) => item.tokenHash === tokenHash);
      const account = row && accounts.find((item) => item.id === row.userId);
      return row && account ? { ...row, user: { status: account.status, person: account.person } } : null;
    }),
    markUsed: vi.fn(async (_tx: unknown, id: string, now: Date) => {
      const row = rows.find((item) => item.id === id);
      if (!row || row.usedAt || row.replacedAt) return false;
      row.usedAt = now;
      return true;
    }),
  };
}

// Redis en memoria con SET NX PX e INCR, que respeta el vencimiento según Date.now().
function fakeRedis() {
  const store = new Map<string, { value: number; expiresAt: number }>();
  const live = (key: string) => {
    const entry = store.get(key);
    if (entry && entry.expiresAt <= Date.now()) store.delete(key);
    return store.get(key);
  };
  return {
    store,
    set: vi.fn(async (key: string, value: string, _px: 'PX', ttl: number, _nx: 'NX') => {
      if (live(key)) return null;
      store.set(key, { value: Number(value), expiresAt: Date.now() + ttl });
      return 'OK';
    }),
    incr: vi.fn(async (key: string) => {
      const entry = live(key) ?? { value: 0, expiresAt: Number.POSITIVE_INFINITY };
      entry.value += 1;
      store.set(key, entry);
      return entry.value;
    }),
  };
}

const cashier: Account = {
  id: 'u-cashier',
  status: 'ACTIVE',
  person: { identification: '1105011850', firstName: 'Camilo', lastName: 'Cajero QA', email: 'ana@correo.com' },
};

function build(accounts: Account[] = [cashier]) {
  const tx = { user: { update: vi.fn(async () => undefined) } };
  const prisma = {
    user: {
      findFirst: vi.fn(async ({ where }: { where: { status: string; person: { email: { equals: string } } } }) => {
        const account = accounts.find(
          (item) => item.status === where.status && item.person.email.toLowerCase() === where.person.email.equals.toLowerCase(),
        );
        return account ? { id: account.id, person: account.person } : null;
      }),
    },
    $transaction: vi.fn(async (run: (client: typeof tx) => Promise<unknown>) => run(tx)),
  };
  const repository = fakeRepository(accounts);
  const hasher = { hash: vi.fn(async (plain: string) => `hashed:${plain}`) };
  const sessions = { revokeAllForUser: vi.fn(async () => undefined) };
  const audit = { record: vi.fn(async () => undefined) };
  const mail = { send: vi.fn(async () => undefined) };
  const redis = fakeRedis();
  const settings: Record<string, unknown> = { 'auth.passwordResetTtlMinutes': 30, 'app.url': 'http://localhost:5174/' };
  const config = { get: vi.fn((key: string) => settings[key]) };
  const service = new RecoverPasswordService(
    prisma as never,
    repository as never,
    hasher as never,
    sessions as never,
    audit as never,
    mail as never,
    redis as never,
    config as never,
  );
  return { service, prisma, tx, repository, hasher, sessions, audit, mail, redis };
}

type Context = ReturnType<typeof build>;

// Pide un enlace y devuelve el token que llegó en el correo.
async function requestLink(ctx: Context, email = 'ana@correo.com') {
  await ctx.service.request({ email });
  const [{ text }] = ctx.mail.send.mock.calls.at(-1) as unknown as [{ text: string }];
  return decodeURIComponent(/token=(\S+)/.exec(text)![1]);
}

const later = (minutes: number, seconds = 0) => vi.setSystemTime(new Date(START.getTime() + minutes * MINUTE + seconds * 1000));

async function rejection(promise: Promise<unknown>) {
  const error = await promise.catch((cause: unknown) => cause);
  expect(error).toBeInstanceOf(ApiException);
  return error as ApiException;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('RecoverPasswordService.request (HU-58)', () => {
  // Positivos
  it('crea un enlace de 30 minutos, lo envía y audita "Solicitar recuperación" sin secretos', async () => {
    const ctx = build();

    const result = await ctx.service.request({ email: 'ana@correo.com' });

    expect(result).toEqual({ message: 'Si el correo está registrado, recibirá un enlace' });
    expect(ctx.repository.rows).toHaveLength(1);
    expect(ctx.repository.rows[0]).toMatchObject({ userId: 'u-cashier', expiresAt: new Date(START.getTime() + 30 * MINUTE) });
    expect(ctx.mail.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'ana@correo.com', subject: 'Restablezca su contraseña de VetManage' }));
    const [{ text }] = ctx.mail.send.mock.calls[0] as unknown as [{ text: string }];
    expect(text).toMatch(/http:\/\/localhost:5174\/reset-password\?token=\S+/);
    expect(ctx.audit.record).toHaveBeenCalledWith(ctx.tx, {
      actorId: 'u-cashier',
      action: 'Solicitar recuperación',
      module: 'Usuarios',
      affectedRecord: '1105011850 - Camilo Cajero QA',
    });
  });

  it('acepta el correo con mayúsculas y espacios alrededor', async () => {
    const ctx = build();

    await ctx.service.request({ email: '  ANA@Correo.com ' });

    expect(ctx.mail.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'ana@correo.com' }));
  });

  it('guarda solo el hash del token, que tiene al menos 32 bytes', async () => {
    const ctx = build();

    const token = await requestLink(ctx);

    expect(Buffer.from(token, 'base64url').length).toBeGreaterThanOrEqual(32);
    expect(ctx.repository.rows[0].tokenHash).toBe(sha256(token));
    expect(JSON.stringify(ctx.repository.rows)).not.toContain(token);
    expect(JSON.stringify(ctx.audit.record.mock.calls)).not.toContain(token);
  });

  // Negativos
  it('con un correo no registrado responde lo mismo y no crea, envía ni audita nada', async () => {
    const ctx = build();

    await expect(ctx.service.request({ email: 'otro@correo.com' })).resolves.toEqual({ message: PASSWORD_RESET_MESSAGES.requested });

    expect(ctx.repository.rows).toHaveLength(0);
    expect(ctx.mail.send).not.toHaveBeenCalled();
    expect(ctx.audit.record).not.toHaveBeenCalled();
  });

  it.each([['INACTIVE'], ['DEACTIVATED']] as const)('con una cuenta %s responde lo mismo y no envía nada', async (status) => {
    const ctx = build([{ ...cashier, status }]);

    await expect(ctx.service.request({ email: 'ana@correo.com' })).resolves.toEqual({ message: PASSWORD_RESET_MESSAGES.requested });

    expect(ctx.repository.rows).toHaveLength(0);
    expect(ctx.mail.send).not.toHaveBeenCalled();
    expect(ctx.audit.record).not.toHaveBeenCalled();
  });

  it.each([['vacío', ''], ['ausente', undefined], ['solo espacios', '   '], ['sin dominio completo', 'ana@correo'], ['sin arroba', 'ana.correo.com']])(
    'rechaza un correo %s con 400 y no envía nada',
    async (_, email) => {
      const ctx = build();

      const error = await rejection(ctx.service.request({ email }));

      expect(error).toMatchObject({ statusCode: 400, message: 'Ingrese un correo electrónico válido' });
      expect(ctx.redis.incr).not.toHaveBeenCalled();
      expect(ctx.mail.send).not.toHaveBeenCalled();
    },
  );

  it('si el servidor de correo falla, responde lo mismo y registra el error en el log', async () => {
    const ctx = build();
    const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    ctx.mail.send.mockRejectedValueOnce(new Error('SMTP caído'));

    await expect(ctx.service.request({ email: 'ana@correo.com' })).resolves.toEqual({ message: PASSWORD_RESET_MESSAGES.requested });

    await vi.waitFor(() => expect(logError).toHaveBeenCalledWith(expect.stringContaining('SMTP caído')));
  });

  it('una nueva solicitud reemplaza el enlace anterior: solo sirve el último', async () => {
    const ctx = build();
    const first = await requestLink(ctx);
    const second = await requestLink(ctx);

    expect(ctx.repository.rows[0].replacedAt).toEqual(START);
    expect((await rejection(ctx.service.validate(first))).message).toBe('El enlace no es válido. Solicite uno nuevo');
    await expect(ctx.service.validate(second)).resolves.toMatchObject({ valid: true });
  });

  // Valor límite: 3 solicitudes cada 15 minutos (Esc. 8)
  it('la 3.ª solicitud en 15 minutos crea y envía un enlace nuevo', async () => {
    const ctx = build();
    await ctx.service.request({ email: 'ana@correo.com' });
    later(5);
    await ctx.service.request({ email: 'ana@correo.com' });
    later(14, 59);

    await ctx.service.request({ email: 'ana@correo.com' });

    expect(ctx.mail.send).toHaveBeenCalledTimes(3);
    expect(ctx.repository.rows).toHaveLength(3);
  });

  it('la 4.ª solicitud en 15 minutos responde lo mismo sin crear, enviar ni auditar', async () => {
    const ctx = build();
    for (let i = 0; i < 3; i += 1) await ctx.service.request({ email: 'ana@correo.com' });
    ctx.mail.send.mockClear();
    ctx.audit.record.mockClear();
    later(14, 59);

    await expect(ctx.service.request({ email: 'ANA@correo.com' })).resolves.toEqual({ message: PASSWORD_RESET_MESSAGES.requested });

    expect(ctx.repository.rows).toHaveLength(3);
    expect(ctx.mail.send).not.toHaveBeenCalled();
    expect(ctx.audit.record).not.toHaveBeenCalled();
  });

  it('pasados 15 minutos desde la primera solicitud se puede pedir otro enlace', async () => {
    const ctx = build();
    for (let i = 0; i < 4; i += 1) await ctx.service.request({ email: 'ana@correo.com' });
    ctx.mail.send.mockClear();
    later(15);

    await ctx.service.request({ email: 'ana@correo.com' });

    expect(ctx.mail.send).toHaveBeenCalledTimes(1);
  });

  it('el límite también cuenta los correos no registrados, sin revelar nada', async () => {
    const ctx = build();
    for (let i = 0; i < 4; i += 1) {
      await expect(ctx.service.request({ email: 'otro@correo.com' })).resolves.toEqual({ message: PASSWORD_RESET_MESSAGES.requested });
    }
    expect(ctx.prisma.user.findFirst).toHaveBeenCalledTimes(3);
  });

  it('si Redis no responde, permite la solicitud y deja una advertencia', async () => {
    const ctx = build();
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    ctx.redis.incr.mockRejectedValueOnce(new Error('Redis caído'));

    await ctx.service.request({ email: 'ana@correo.com' });

    expect(ctx.mail.send).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Redis caído'));
  });
});

describe('RecoverPasswordService.validate (HU-58)', () => {
  // Positivos
  it('un enlace de 10 minutos es válido', async () => {
    const ctx = build();
    const token = await requestLink(ctx);
    later(10);

    await expect(ctx.service.validate(token)).resolves.toEqual({ valid: true, message: 'Enlace válido' });
  });

  // Valor límite
  it('a los 29:59 el enlace sigue vigente', async () => {
    const ctx = build();
    const token = await requestLink(ctx);
    later(29, 59);

    await expect(ctx.service.validate(token)).resolves.toMatchObject({ valid: true });
  });

  it.each([['exactamente 30:00', 30, 0], ['más de 30 minutos', 45, 0]])('a %s responde 410 «ha expirado»', async (_, minutes, seconds) => {
    const ctx = build();
    const token = await requestLink(ctx);
    later(minutes, seconds);

    const error = await rejection(ctx.service.validate(token));

    expect(error).toMatchObject({ statusCode: 410, message: 'El enlace ha expirado. Solicite uno nuevo' });
  });

  // Negativos
  it.each([['inexistente', 'token-que-no-existe'], ['vacío', ''], ['ausente', undefined]])('un token %s responde 400 «no es válido»', async (_, token) => {
    const ctx = build();

    const error = await rejection(ctx.service.validate(token));

    expect(error).toMatchObject({ statusCode: 400, message: 'El enlace no es válido. Solicite uno nuevo' });
  });

  it('un enlace ya usado responde 400 aunque siga dentro de los 30 minutos', async () => {
    const ctx = build();
    const token = await requestLink(ctx);
    await ctx.service.confirm({ token, newPassword: 'NuevaClave2026', confirmPassword: 'NuevaClave2026' });

    expect((await rejection(ctx.service.validate(token))).statusCode).toBe(400);
  });

  it('si la cuenta se inactivó después de pedir el enlace, el enlace no es válido', async () => {
    const account = { ...cashier };
    const ctx = build([account]);
    const token = await requestLink(ctx);
    account.status = 'INACTIVE';

    expect((await rejection(ctx.service.validate(token))).message).toBe(PASSWORD_RESET_MESSAGES.invalidLink);
  });
});

describe('RecoverPasswordService.confirm (HU-58)', () => {
  // Positivos
  it('restablece la contraseña, limpia el bloqueo, cierra las sesiones y audita sin secretos', async () => {
    const ctx = build();
    const token = await requestLink(ctx);
    later(10);
    ctx.audit.record.mockClear();

    const result = await ctx.service.confirm({ token, newPassword: 'NuevaClave2026', confirmPassword: 'NuevaClave2026' });

    expect(result).toEqual({ message: 'Contraseña actualizada. Inicie sesión con su nueva contraseña' });
    expect(ctx.tx.user.update).toHaveBeenCalledWith({
      where: { id: 'u-cashier' },
      data: { password: 'hashed:NuevaClave2026', mustChangePassword: false, failedLoginAttempts: 0, isLocked: false, lockedAt: null },
    });
    expect(ctx.repository.rows[0].usedAt).toEqual(new Date(START.getTime() + 10 * MINUTE));
    expect(ctx.sessions.revokeAllForUser).toHaveBeenCalledWith('u-cashier', ctx.tx);
    expect(ctx.audit.record).toHaveBeenCalledWith(ctx.tx, {
      actorId: 'u-cashier',
      action: 'Restablecer contraseña',
      module: 'Usuarios',
      affectedRecord: '1105011850 - Camilo Cajero QA',
    });
    const audited = JSON.stringify(ctx.audit.record.mock.calls[0][1]);
    expect(audited).not.toContain('NuevaClave2026');
    expect(audited).not.toContain(token);
  });

  // Valor límite
  it('acepta una contraseña de exactamente 8 caracteres', async () => {
    const ctx = build();
    const token = await requestLink(ctx);

    await expect(ctx.service.confirm({ token, newPassword: 'Clave123', confirmPassword: 'Clave123' })).resolves.toEqual({
      message: PASSWORD_RESET_MESSAGES.updated,
    });
  });

  it('acepta el enlace a los 29:59', async () => {
    const ctx = build();
    const token = await requestLink(ctx);
    later(29, 59);

    await expect(ctx.service.confirm({ token, newPassword: 'Clave123', confirmPassword: 'Clave123' })).resolves.toEqual({
      message: PASSWORD_RESET_MESSAGES.updated,
    });
  });

  it('a los 30:00 responde 410 y no cambia la contraseña', async () => {
    const ctx = build();
    const token = await requestLink(ctx);
    later(30);

    const error = await rejection(ctx.service.confirm({ token, newPassword: 'Clave123', confirmPassword: 'Clave123' }));

    expect(error).toMatchObject({ statusCode: 410, message: PASSWORD_RESET_MESSAGES.expired });
    expect(ctx.tx.user.update).not.toHaveBeenCalled();
    expect(ctx.repository.rows[0].usedAt).toBeNull();
  });

  // Negativos
  it.each([
    ['de 7 caracteres', 'Clave12'],
    ['que no cumple las reglas', 'abc123'],
    ['sin mayúscula', 'clave2026'],
    ['sin número', 'ClaveSegura'],
  ])('rechaza una contraseña %s con el mensaje de la política y el enlace sigue sirviendo', async (_, password) => {
    const ctx = build();
    const token = await requestLink(ctx);
    ctx.audit.record.mockClear();

    const error = await rejection(ctx.service.confirm({ token, newPassword: password, confirmPassword: password }));

    expect(error).toMatchObject({
      statusCode: 400,
      message: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número',
    });
    expect(ctx.tx.user.update).not.toHaveBeenCalled();
    expect(ctx.audit.record).not.toHaveBeenCalled();
    await expect(ctx.service.validate(token)).resolves.toMatchObject({ valid: true });
  });

  it('rechaza una confirmación distinta y el enlace sigue sirviendo', async () => {
    const ctx = build();
    const token = await requestLink(ctx);

    const error = await rejection(ctx.service.confirm({ token, newPassword: 'NuevaClave2026', confirmPassword: 'NuevaClave2027' }));

    expect(error).toMatchObject({ statusCode: 400, message: 'Las contraseñas no coinciden' });
    await expect(ctx.service.validate(token)).resolves.toMatchObject({ valid: true });
  });

  it.each([
    ['la nueva contraseña', { newPassword: '', confirmPassword: 'NuevaClave2026' }],
    ['la confirmación', { newPassword: 'NuevaClave2026', confirmPassword: '   ' }],
    ['ambos campos', {}],
  ])('rechaza con «Complete los campos obligatorios» si falta %s', async (_, fields) => {
    const ctx = build();
    const token = await requestLink(ctx);

    const error = await rejection(ctx.service.confirm({ token, ...fields }));

    expect(error).toMatchObject({ statusCode: 400, message: 'Complete los campos obligatorios' });
  });

  it('un enlace ya usado no sirve una segunda vez', async () => {
    const ctx = build();
    const token = await requestLink(ctx);
    await ctx.service.confirm({ token, newPassword: 'NuevaClave2026', confirmPassword: 'NuevaClave2026' });
    ctx.audit.record.mockClear();

    const error = await rejection(ctx.service.confirm({ token, newPassword: 'OtraClave2026', confirmPassword: 'OtraClave2026' }));

    expect(error).toMatchObject({ statusCode: 400, message: PASSWORD_RESET_MESSAGES.invalidLink });
    expect(ctx.tx.user.update).toHaveBeenCalledTimes(1);
    expect(ctx.audit.record).not.toHaveBeenCalled();
  });

  it('valida primero el enlace: uno vencido con contraseña débil responde 410', async () => {
    const ctx = build();
    const token = await requestLink(ctx);
    later(31);

    expect((await rejection(ctx.service.confirm({ token, newPassword: 'abc', confirmPassword: 'xyz' }))).statusCode).toBe(410);
  });

  it('si la auditoría falla, el restablecimiento falla (misma transacción)', async () => {
    const ctx = build();
    const token = await requestLink(ctx);
    ctx.audit.record.mockRejectedValueOnce(new Error('fallo de auditoría'));

    await expect(ctx.service.confirm({ token, newPassword: 'NuevaClave2026', confirmPassword: 'NuevaClave2026' })).rejects.toThrow(
      'fallo de auditoría',
    );
  });
});
