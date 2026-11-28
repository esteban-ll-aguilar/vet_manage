import { describe, expect, it, vi } from 'vitest';
import { CalendarRepository } from './calendar.repository.js';
import { calendarPeriod } from '../services/calendar-period.js';

function build() {
  const tx = {
    sucursal: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue({ id: 'loja' }),
    },
    horarioBase: {
      findMany: vi.fn().mockResolvedValue([{ veterinarioId: 'v1' }]),
    },
    cita: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    sala: { findMany: vi.fn().mockResolvedValue([]) },
    bloqueoHorario: { findMany: vi.fn().mockResolvedValue([]) },
    turnoSabado: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const transaction = vi.fn(async (fn: (client: typeof tx) => unknown) =>
    fn(tx),
  );
  return {
    tx,
    transaction,
    repo: new CalendarRepository({ ...tx, $transaction: transaction } as never),
  };
}
describe('CalendarRepository aislamiento y ocupación', () => {
  it.each(['dia', 'semana', 'mes'] as const)(
    'consulta intersección estricta en %s sin filtro de estado visible',
    async (vista) => {
      const { repo, tx, transaction } = build();
      const p = calendarPeriod('2026-11-02', vista);
      await repo.snapshot('loja', p.inicio, p.fin, p.desde, p.hastaExclusiva);
      expect(tx.cita.findMany.mock.calls[0][0].where).toEqual({
        fechaHora: { lt: p.fin },
        fechaHoraFin: { gt: p.inicio },
        sala: { sucursalId: 'loja' },
      });
      expect(tx.cita.findMany.mock.calls[1][0].where).toEqual({
        fechaHora: { lt: p.fin },
        fechaHoraFin: { gt: p.inicio },
        estado: { not: 'CANCELADA' },
        OR: [
          { sala: { sucursalId: 'loja' } },
          { veterinarioId: { in: ['v1'] } },
        ],
      });
      expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: 'RepeatableRead',
      });
      expect(tx.bloqueoHorario.findMany.mock.calls[0][0].where).toMatchObject({
        sucursalId: 'loja',
        fechaEliminacion: null,
      });
      expect(tx.sala.findMany.mock.calls[0][0].where).toEqual({
        sucursalId: 'loja',
        estado: true,
        tipo: 'CONSULTORIO',
      });
    },
  );
  it('excluye jornadas con rol de veterinario vencido como el registro de citas', async () => {
    const { repo, tx } = build();
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-27T15:00:00Z'));
      const p = calendarPeriod('2026-11-02', 'dia');
      await repo.snapshot('loja', p.inicio, p.fin, p.desde, p.hastaExclusiva);
      expect(tx.horarioBase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            veterinario: {
              status: 'ACTIVE',
              userRoles: {
                some: {
                  role: { name: 'veterinarian', isActive: true },
                  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
                },
              },
            },
          }),
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });
  it('detalle limita sucursal e incluye solo datos requeridos de cliente', async () => {
    const { repo, tx } = build();
    await repo.detail('c1', 'vilcabamba');
    expect(tx.cita.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'c1', sala: { sucursalId: 'vilcabamba' } },
      }),
    );
  });
});
