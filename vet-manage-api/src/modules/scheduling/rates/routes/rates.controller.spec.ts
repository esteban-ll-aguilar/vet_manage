import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { success } from '../../../../common/errors/api-response.js';
import { PERMISSIONS_METADATA } from '../../../identity/decorators/require-permissions.decorator.js';
import { RatesController } from './rates.controller.js';

function build() {
  const service = {
    list: vi.fn(async () => []),
    listServices: vi.fn(async () => []),
    save: vi.fn(async (dto: unknown) => dto),
    update: vi.fn(async (_id: string, dto: unknown) => dto),
    deactivateService: vi.fn(async (id: string) => ({ id, estado: false })),
    activateService: vi.fn(async (id: string) => ({ id, estado: true })),
  };
  return { controller: new RatesController(service as never), service };
}

describe('RatesController', () => {
  it('CP-025-09 protege lectura con rates:read', () => {
    const method = Object.getOwnPropertyDescriptor(RatesController.prototype, 'list')?.value;
    expect(Reflect.getMetadata(PERMISSIONS_METADATA, method as object)).toEqual(['rates:read']);
  });

  it('CP-025-09 protege creación con rates:manage', () => {
    const method = Object.getOwnPropertyDescriptor(RatesController.prototype, 'create')?.value;
    expect(Reflect.getMetadata(PERMISSIONS_METADATA, method as object)).toEqual(['rates:manage']);
  });

  it('CP-025-09 protege actualización con rates:manage', () => {
    const method = Object.getOwnPropertyDescriptor(RatesController.prototype, 'update')?.value;
    expect(Reflect.getMetadata(PERMISSIONS_METADATA, method as object)).toEqual(['rates:manage']);
  });

  it('CP-025-09 protege desactivación con rates:manage', () => {
    const method = Object.getOwnPropertyDescriptor(RatesController.prototype, 'deactivateService')?.value;
    expect(Reflect.getMetadata(PERMISSIONS_METADATA, method as object)).toEqual(['rates:manage']);
  });

  it('CP-025-09 protege activación con rates:manage', () => {
    const method = Object.getOwnPropertyDescriptor(RatesController.prototype, 'activateService')?.value;
    expect(Reflect.getMetadata(PERMISSIONS_METADATA, method as object)).toEqual(['rates:manage']);
  });

  it('protege el catálogo completo de servicios con rates:read', () => {
    const method = Object.getOwnPropertyDescriptor(RatesController.prototype, 'listServices')?.value;
    expect(Reflect.getMetadata(PERMISSIONS_METADATA, method as object)).toEqual(['rates:read']);
  });

  it('CP-025-01 devuelve el catálogo en el envelope success', async () => {
    const ctx = build();
    await expect(ctx.controller.list('s1', 'b1')).resolves.toEqual(success([], 'Catálogo de tarifas'));
  });

  it('CP-025-03 activa un servicio por el endpoint protegido', async () => {
    const ctx = build();

    await expect(ctx.controller.activateService('s1'))
      .resolves.toEqual(success({ id: 's1', estado: true }, 'Servicio activado correctamente'));
    expect(ctx.service.activateService).toHaveBeenCalledWith('s1');
  });
});
