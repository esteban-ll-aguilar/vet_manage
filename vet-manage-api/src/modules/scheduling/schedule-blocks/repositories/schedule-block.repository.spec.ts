import { describe, expect, it, vi } from 'vitest';
import { ScheduleBlockRepository } from './schedule-block.repository.js';

const NOW = new Date('2026-11-02T15:00:00.000Z');

function build(count: number) {
  const updateMany = vi.fn(async () => ({ count }));
  return { repository: new ScheduleBlockRepository({ bloqueoHorario: { updateMany } } as never), updateMany };
}

describe('ScheduleBlockRepository.softDelete', () => {
  it('marca como eliminado solo el bloqueo indicado si sigue vigente', async () => {
    const { repository, updateMany } = build(1);

    const removed = await repository.softDelete('block-1', 'admin-1', NOW);

    expect(removed).toBe(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'block-1', fechaEliminacion: null },
      data: { fechaEliminacion: NOW, eliminadoPorId: 'admin-1' },
    });
  });

  it('devuelve 0 si el bloqueo ya estaba eliminado, sin cambiar su registro', async () => {
    const { repository } = build(0);

    expect(await repository.softDelete('block-1', 'admin-2', NOW)).toBe(0);
  });
});
