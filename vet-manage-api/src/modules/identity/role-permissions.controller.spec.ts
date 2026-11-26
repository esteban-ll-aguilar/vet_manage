import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { PERMISSIONS_METADATA } from './decorators/require-permissions.decorator.js';
import { RolePermissionsController } from './role-permissions.controller.js';

describe('RolePermissionsController', () => {
  it('protege lectura y cambios con roles:manage-permissions', () => {
    const getCatalog = Object.getOwnPropertyDescriptor(RolePermissionsController.prototype, 'getCatalog')?.value;
    const update = Object.getOwnPropertyDescriptor(RolePermissionsController.prototype, 'update')?.value;

    expect(Reflect.getMetadata(PERMISSIONS_METADATA, getCatalog))
      .toEqual(['roles:manage-permissions']);
    expect(Reflect.getMetadata(PERMISSIONS_METADATA, update))
      .toEqual(['roles:manage-permissions']);
  });
});
