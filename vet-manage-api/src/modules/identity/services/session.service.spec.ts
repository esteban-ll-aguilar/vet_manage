import { durationToMs } from './session.service.js';

describe('durationToMs', () => {
  it.each([
    ['30s', 30_000],
    ['15m', 900_000],
    ['12h', 43_200_000],
    ['7d', 604_800_000],
  ])('convierte %s', (value, expected) => {
    expect(durationToMs(value)).toBe(expected);
  });

  it('rechaza un formato inválido', () => {
    expect(() => durationToMs('12 horas')).toThrow();
  });
});

describe('SessionService.revokeAllForUser (HU-58)', () => {
  it('revoca solo las sesiones abiertas de la cuenta, con el cliente de la transacción', async () => {
    const { SessionService } = await import('./session.service.js');
    const prisma = { userSession: { updateMany: vi.fn() } };
    const tx = { userSession: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) } };
    const service = new SessionService(prisma as never, { getOrThrow: () => '12h' } as never);

    await service.revokeAllForUser('u-1', tx as never);

    expect(tx.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.userSession.updateMany).not.toHaveBeenCalled();
  });
});
