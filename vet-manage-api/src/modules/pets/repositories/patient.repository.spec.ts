import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PatientRepository } from './patient.repository.js';

type FindManyArgs = { where?: unknown; orderBy?: unknown; skip?: number; take?: number };
type CountArgs = { where?: unknown };

function build() {
  const findMany = vi.fn(async (_args: FindManyArgs) => [] as unknown[]);
  const count = vi.fn(async (_args: CountArgs) => 0);
  const prisma = { patient: { findMany, count } };
  const repository = new PatientRepository(prisma as never);
  return { repository, findMany, count };
}

const whereOf = (findMany: ReturnType<typeof build>['findMany']): Record<string, unknown> =>
  (findMany.mock.calls[0]?.[0]?.where ?? {}) as Record<string, unknown>;

describe('PatientRepository.searchPatients', () => {
  let ctx: ReturnType<typeof build>;

  beforeEach(() => {
    ctx = build();
  });

  it('busca por código con igualdad exacta y en mayúsculas', async () => {
    await ctx.repository.searchPatients({ search: ' pac-000001 ', page: 1, pageSize: 20 });
    expect(whereOf(ctx.findMany)).toEqual({ code: { equals: 'PAC-000001' } });
  });

  it('acepta el código de 4 dígitos del ejemplo de la HU', async () => {
    await ctx.repository.searchPatients({ search: ' pac-0001 ', page: 1, pageSize: 20 });
    expect(whereOf(ctx.findMany)).toEqual({ code: { equals: 'PAC-0001' } });
  });

  it('busca por prefijo de cédula con 5 a 10 dígitos', async () => {
    await ctx.repository.searchPatients({ search: '096144', page: 1, pageSize: 20 });
    expect(whereOf(ctx.findMany)).toEqual({
      client: { person: { identification: { startsWith: '096144' } } },
    });
  });

  it('usa el nombre del paciente desde 2 caracteres y el del cliente desde 3', async () => {
    await ctx.repository.searchPatients({ search: 'an', page: 1, pageSize: 20 });
    const where = whereOf(ctx.findMany);
    expect(where.OR).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: expect.objectContaining({ mode: 'insensitive' }) }),
    ]));
    expect(JSON.stringify(where)).not.toContain('firstName');
  });

  it('combina nombre del paciente y del cliente con 3 o más caracteres', async () => {
    await ctx.repository.searchPatients({ search: 'ana', page: 1, pageSize: 20 });
    const serialized = JSON.stringify(whereOf(ctx.findMany));
    expect(serialized).toContain('firstName');
    expect(serialized).toContain('name');
  });

  it('ignora tildes y mayúsculas al generar variantes', async () => {
    await ctx.repository.searchPatients({ search: 'josé', page: 1, pageSize: 20 });
    const serialized = JSON.stringify(whereOf(ctx.findMany));
    expect(serialized).toContain('jose');
    expect(serialized).toContain('josé');
    expect(serialized).toContain('mode');
  });

  it('trata 4 dígitos como texto de nombre, no como cédula', async () => {
    await ctx.repository.searchPatients({ search: '0961', page: 1, pageSize: 20 });
    expect(whereOf(ctx.findMany)).not.toHaveProperty('client.person.identification');
  });

  it('devuelve el listado completo sin where cuando no hay término', async () => {
    await ctx.repository.searchPatients({ page: 2, pageSize: 10 });
    expect(whereOf(ctx.findMany)).toEqual({});
    expect(ctx.findMany.mock.calls[0][0]).toMatchObject({
      orderBy: [{ name: 'asc' }, { code: 'asc' }],
      skip: 10,
      take: 10,
    });
  });

  it('usa el mismo where para findMany y count', async () => {
    await ctx.repository.searchPatients({ search: 'firulais', page: 1, pageSize: 20 });
    expect(ctx.count.mock.calls[0][0].where).toEqual(whereOf(ctx.findMany));
  });
});
