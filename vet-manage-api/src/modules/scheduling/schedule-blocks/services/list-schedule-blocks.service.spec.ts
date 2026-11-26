import { describe, expect, it, vi } from 'vitest';
import { ApiException } from '../../../../common/errors/api-exception.js';
import { LIST_BLOCK_MESSAGES as M, ListScheduleBlocksService } from './list-schedule-blocks.service.js';

const SUCURSAL_ID = '11111111-1111-4111-8111-111111111111';

const record = {
  id: 'block-1',
  fecha: new Date('2026-11-03T00:00:00.000Z'),
  horaInicio: new Date('1970-01-01T12:00:00.000Z'),
  horaFin: new Date('1970-01-01T13:00:00.000Z'),
  motivo: 'Mantenimiento',
  creadoEn: new Date('2026-11-01T08:00:00.000Z'),
  sucursal: { id: SUCURSAL_ID, nombre: 'Loja' },
  veterinario: null,
  registradoPor: { person: { firstName: 'Marcelo', lastName: 'Paredes' } },
};

function build() {
  const repository = {
    listActive: vi.fn(async () => [record]),
    listActiveVeterinarians: vi.fn(async () => [{ id: 'vet-1', person: { firstName: 'Valentina', lastName: 'Ruiz' } }]),
  };
  return { service: new ListScheduleBlocksService(repository as never), repository };
}

describe('ListScheduleBlocksService', () => {
  it('lista los bloqueos vigentes con los filtros indicados', async () => {
    const { service, repository } = build();

    const blocks = await service.listBlocks({ sucursalId: SUCURSAL_ID, desde: '2026-11-01', hasta: '2026-11-30' });

    expect(repository.listActive).toHaveBeenCalledWith({
      sucursalId: SUCURSAL_ID,
      desde: new Date('2026-11-01T00:00:00.000Z'),
      hasta: new Date('2026-11-30T00:00:00.000Z'),
    });
    expect(blocks).toEqual([expect.objectContaining({
      alcance: 'SUCURSAL', veterinario: null, fecha: '2026-11-03', horaInicio: '12:00', horaFin: '13:00',
    })]);
  });

  it('sin filtros lista todos los bloqueos vigentes', async () => {
    const { service, repository } = build();

    await service.listBlocks({ sucursalId: ' ', desde: '' });

    expect(repository.listActive).toHaveBeenCalledWith({ sucursalId: undefined, desde: undefined, hasta: undefined });
  });

  it.each([
    [{ sucursalId: 'no-es-uuid' }, M.invalidBranch],
    [{ desde: '03/11/2026' }, M.invalidDate],
    [{ desde: '2026-11-30', hasta: '2026-11-01' }, M.invalidRange],
  ])('rechaza filtros inválidos %#', async (filter, message) => {
    const { service, repository } = build();

    const error = await service.listBlocks(filter).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).message).toBe(message);
    expect(repository.listActive).not.toHaveBeenCalled();
  });

  it('lista los veterinarios activos con su nombre completo', async () => {
    expect(await build().service.listVeterinarians()).toEqual([{ id: 'vet-1', nombre: 'Valentina Ruiz' }]);
  });
});
