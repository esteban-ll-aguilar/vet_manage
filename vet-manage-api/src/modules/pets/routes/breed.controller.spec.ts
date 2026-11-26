import 'reflect-metadata';
import { ParseUUIDPipe } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { success } from '../../../common/errors/api-response.js';
import { PERMISSIONS_METADATA } from '../../identity/decorators/require-permissions.decorator.js';
import { BreedController } from './breed.controller.js';

function build() {
  const findBreeds = {
    list: vi.fn(async () => ({ breeds: [], message: 'No se encontraron razas con el criterio ingresado' })),
    findById: vi.fn(async (id: string) => ({ id, name: 'Siamés', species: { id: 's1', name: 'Felino' } })),
  };
  const controller = new BreedController({} as never, {} as never, {} as never, findBreeds as never);
  return { controller, findBreeds };
}

const permissionsOf = (method: keyof BreedController) =>
  Reflect.getMetadata(PERMISSIONS_METADATA, BreedController.prototype[method]) as string[];

describe('BreedController – consulta de razas (HU-20)', () => {
  it('el listado y el detalle requieren breeds:read', () => {
    expect(permissionsOf('listBreeds')).toEqual(['breeds:read']);
    expect(permissionsOf('getBreed')).toEqual(['breeds:read']);
  });

  it('pasa los filtros al servicio y responde con su mensaje', async () => {
    const { controller, findBreeds } = build();
    const response = await controller.listBreeds({ search: 'xyz', speciesId: undefined });
    expect(findBreeds.list).toHaveBeenCalledWith({ search: 'xyz', speciesId: undefined });
    expect(response).toEqual(success([], 'No se encontraron razas con el criterio ingresado'));
  });

  it('devuelve el detalle de una raza', async () => {
    const { controller, findBreeds } = build();
    const response = await controller.getBreed('b1');
    expect(findBreeds.findById).toHaveBeenCalledWith('b1');
    expect(response).toEqual(success({ id: 'b1', name: 'Siamés', species: { id: 's1', name: 'Felino' } }, 'Raza consultada correctamente'));
  });

  it('valida el id del detalle con ParseUUIDPipe (400 si no es UUID)', async () => {
    await expect(new ParseUUIDPipe().transform('no-es-uuid', { type: 'param' })).rejects.toThrow();
  });
});
