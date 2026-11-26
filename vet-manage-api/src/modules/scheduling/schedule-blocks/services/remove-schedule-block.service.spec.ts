import { describe, expect, it, vi } from 'vitest';
import { ApiException } from '../../../../common/errors/api-exception.js';
import { REMOVE_BLOCK_MESSAGES as M, RemoveScheduleBlockService } from './remove-schedule-block.service.js';

const BLOCK_ID = '33333333-3333-4333-8333-333333333333';
const ACTOR_ID = 'admin-1';
const NOW = new Date('2026-11-02T15:00:00.000Z');

function build(removed = 1) {
  const repository = { softDelete: vi.fn(async () => removed) };
  return { service: new RemoveScheduleBlockService(repository as never), repository };
}

async function expectNotFound(promise: Promise<unknown>) {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(ApiException);
  expect((error as ApiException).message).toBe(M.notFound);
  expect((error as ApiException).statusCode).toBe(404);
  expect((error as ApiException).code).toBe('SCHEDULE_BLOCK_NOT_FOUND');
}

describe('RemoveScheduleBlockService', () => {
  it('elimina el bloqueo de forma lógica y guarda quién y cuándo lo eliminó', async () => {
    const { service, repository } = build();

    const result = await service.execute(BLOCK_ID, ACTOR_ID, NOW);

    expect(repository.softDelete).toHaveBeenCalledWith(BLOCK_ID, ACTOR_ID, NOW);
    expect(result).toEqual({ id: BLOCK_ID, fechaEliminacion: '2026-11-02T15:00:00.000Z' });
  });

  it('elimina solo el bloqueo seleccionado, sin tocar otros del mismo horario', async () => {
    const { service, repository } = build();

    await service.execute(BLOCK_ID, ACTOR_ID, NOW);

    // Una sola eliminación, filtrada por el id del bloqueo elegido.
    expect(repository.softDelete).toHaveBeenCalledTimes(1);
    expect(repository.softDelete).toHaveBeenCalledWith(BLOCK_ID, expect.anything(), expect.anything());
  });

  it('si otra persona ya lo eliminó responde "El bloqueo ya no existe"', async () => {
    const { service, repository } = build(0);

    await expectNotFound(service.execute(BLOCK_ID, ACTOR_ID, NOW));
    expect(repository.softDelete).toHaveBeenCalledTimes(1);
  });

  it('con un id inválido responde lo mismo y no intenta eliminar nada', async () => {
    const { service, repository } = build();

    await expectNotFound(service.execute('no-es-uuid', ACTOR_ID, NOW));
    expect(repository.softDelete).not.toHaveBeenCalled();
  });

  it('usa la fecha actual si no se indica otra', async () => {
    const { service } = build();

    const result = await service.execute(BLOCK_ID, ACTOR_ID);

    expect(Number.isNaN(Date.parse(result.fechaEliminacion))).toBe(false);
  });
});
