import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiException } from '../../../../common/errors/api-exception.js';
import { BREED_QUERY_MESSAGES, ListBreedsQueryDto } from '../../dtos/breeds/list-breeds-query.dto.js';
import type { BreedRepository, BreedWithSpecies } from '../../repositories/breed.repository.js';
import { FIND_BREEDS_MESSAGES, FindBreedsService } from './find-breeds.service.js';

const CANINO = { id: '11111111-1111-4111-8111-111111111111', name: 'Canino' };
const FELINO = { id: '22222222-2222-4222-8222-222222222222', name: 'Felino' };

const breed = (name: string, species = CANINO, isActive = true): BreedWithSpecies => ({
  id: `b-${name}`,
  name,
  description: null,
  isActive,
  speciesId: species.id,
  species,
  createdAt: new Date(),
  updatedAt: new Date(),
});

function build(result: BreedWithSpecies[] = []) {
  const repository = {
    findByFilters: vi.fn(async () => result),
    findByIdWithSpecies: vi.fn(async (id: string) => (id === 'b-Siamés' ? breed('Siamés', FELINO) : null)),
  };
  return { service: new FindBreedsService(repository as unknown as BreedRepository), repository };
}

// Transforma y valida la query como lo hace el ValidationPipe global.
async function validateQuery(query: Record<string, unknown>) {
  const dto = plainToInstance(ListBreedsQueryDto, query);
  const errors = await validate(dto);
  return { dto, messages: errors.flatMap((error) => Object.values(error.constraints ?? {})) };
}

describe('FindBreedsService (HU-20)', () => {
  let ctx: ReturnType<typeof build>;

  beforeEach(() => {
    ctx = build([breed('Labrador Retriever'), breed('Siamés', FELINO)]);
  });

  describe('positivos', () => {
    it('sin filtros consulta todas las razas', async () => {
      const result = await ctx.service.list({});
      expect(ctx.repository.findByFilters).toHaveBeenCalledWith({ speciesId: undefined, nameVariants: undefined });
      expect(result).toEqual({ breeds: expect.any(Array), message: FIND_BREEDS_MESSAGES.found });
      expect(result.breeds).toHaveLength(2);
    });

    it('busca por coincidencia parcial del nombre', async () => {
      await ctx.service.list({ search: 'labra' });
      expect(ctx.repository.findByFilters).toHaveBeenCalledWith({ speciesId: undefined, nameVariants: expect.arrayContaining(['labra', 'lábra']) });
    });

    it('busca sin distinguir mayúsculas ni tildes: SIAMES incluye la variante siamés', async () => {
      await ctx.service.list({ search: 'SIAMES' });
      const { nameVariants } = ctx.repository.findByFilters.mock.calls[0][0] as { nameVariants: string[] };
      expect(nameVariants).toContain('siames');
      expect(nameVariants).toContain('siamés');
    });

    it('filtra por especie', async () => {
      await ctx.service.list({ speciesId: FELINO.id });
      expect(ctx.repository.findByFilters).toHaveBeenCalledWith({ speciesId: FELINO.id, nameVariants: undefined });
    });

    it('combina búsqueda y especie', async () => {
      await ctx.service.list({ search: 'mestizo', speciesId: CANINO.id });
      expect(ctx.repository.findByFilters).toHaveBeenCalledWith({ speciesId: CANINO.id, nameVariants: expect.arrayContaining(['mestizo']) });
    });

    it('devuelve también razas inactivas', async () => {
      ctx = build([breed('Persa', FELINO, false)]);
      const { breeds } = await ctx.service.list({ search: 'persa' });
      expect(breeds[0].isActive).toBe(false);
    });

    it('devuelve el detalle de una raza con su especie', async () => {
      const detail = await ctx.service.findById('b-Siamés');
      expect(detail).toMatchObject({ name: 'Siamés', species: { name: 'Felino' }, isActive: true });
    });
  });

  describe('negativos', () => {
    it('sin resultados devuelve lista vacía con el mensaje de la HU', async () => {
      ctx = build([]);
      await expect(ctx.service.list({ search: 'xyz' })).resolves.toEqual({
        breeds: [],
        message: 'No se encontraron razas con el criterio ingresado',
      });
    });

    it('detalle de una raza inexistente responde 404 "Raza no encontrada"', async () => {
      const error = await ctx.service.findById('no-existe').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ApiException);
      expect(error).toMatchObject({ statusCode: 404, message: 'Raza no encontrada' });
    });

    it('rechaza un speciesId que no es UUID con "Especie no válida"', async () => {
      const { messages } = await validateQuery({ speciesId: 'felino' });
      expect(messages).toEqual([BREED_QUERY_MESSAGES.invalidSpecies]);
    });
  });

  describe('valor límite', () => {
    it('una búsqueda vacía o solo con espacios se ignora', async () => {
      for (const search of ['', '   ']) {
        const { dto, messages } = await validateQuery({ search });
        expect(messages).toEqual([]);
        expect(dto.search).toBeUndefined();
      }
      await ctx.service.list({ search: '   ' });
      expect(ctx.repository.findByFilters).toHaveBeenLastCalledWith({ speciesId: undefined, nameVariants: undefined });
    });

    it('acepta una búsqueda de 1 carácter', async () => {
      expect((await validateQuery({ search: 'a' })).messages).toEqual([]);
      await ctx.service.list({ search: 'a' });
      expect(ctx.repository.findByFilters).toHaveBeenLastCalledWith({ speciesId: undefined, nameVariants: ['a', 'á'] });
    });

    it('acepta una búsqueda de 100 caracteres', async () => {
      expect((await validateQuery({ search: 'b'.repeat(100) })).messages).toEqual([]);
    });

    it('rechaza una búsqueda de 101 caracteres con el mensaje de la HU', async () => {
      const { messages } = await validateQuery({ search: 'b'.repeat(101) });
      expect(messages).toEqual(['La búsqueda no puede superar 100 caracteres']);
    });

    it('los espacios exteriores no cuentan para el límite', async () => {
      expect((await validateQuery({ search: `  ${'b'.repeat(100)}  ` })).messages).toEqual([]);
    });
  });
});
