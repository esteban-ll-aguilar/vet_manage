import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { PERMISSIONS_METADATA } from '../identity/decorators/require-permissions.decorator.js';
import { InventoryController } from './inventory.controller.js';

describe('InventoryController RBAC (HU-01)', () => {
  const permissionOf = (method: string) =>
    Reflect.getMetadata(PERMISSIONS_METADATA, InventoryController.prototype[method as keyof InventoryController]) as string[];

  it('protects catalog reads with inventory:read', () => {
    for (const method of ['listCategories', 'listBrands', 'listProducts', 'getProduct']) {
      expect(permissionOf(method), method).toEqual(['inventory:read']);
    }
  });

  it('protects catalog writes with their specific management permission', () => {
    expect(permissionOf('createCategory')).toEqual(['inventory:manage-categories']);
    expect(permissionOf('updateCategory')).toEqual(['inventory:manage-categories']);
    expect(permissionOf('createBrand')).toEqual(['inventory:manage-brands']);
    expect(permissionOf('updateBrand')).toEqual(['inventory:manage-brands']);
    expect(permissionOf('createProduct')).toEqual(['inventory:manage-products']);
    expect(permissionOf('updateProduct')).toEqual(['inventory:manage-products']);
  });
});
