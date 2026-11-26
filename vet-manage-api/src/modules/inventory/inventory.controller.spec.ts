import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import type { ArgumentMetadata, ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS_METADATA } from '../identity/decorators/require-permissions.decorator.js';
import { PermissionsGuard } from '../identity/guards/permissions.guard.js';
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

  it('protects VAT updates with the dedicated permission', () => {
    expect(permissionOf('updateCategoryVat')).toEqual(['inventory:configure-vat']);
  });

  it('accepts a UUID and rejects a malformed category id', async () => {
    const pipe = new ParseUUIDPipe();
    const metadata: ArgumentMetadata = { type: 'param', data: 'id', metatype: String };
    const id = '123e4567-e89b-42d3-a456-426614174000';

    await expect(pipe.transform(id, metadata)).resolves.toBe(id);
    await expect(pipe.transform('not-a-uuid', metadata)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns VAT updates using the standard API response envelope', async () => {
    const category = { id: 'category-1', name: 'Accesorios', vatRate: '12.5' };
    const updateCategoryVat = vi.fn().mockResolvedValue(category);
    const inventoryService = { updateCategoryVat };
    const controller = new InventoryController(inventoryService as never);

    await expect(controller.updateCategoryVat('category-1', { vatRate: '12.5' })).resolves.toEqual({
      statusCode: 200,
      success: true,
      message: 'IVA actualizado correctamente',
      data: category,
    });
    expect(updateCategoryVat).toHaveBeenCalledWith('category-1', '12.5');
  });

  it('allows a user with the configured permission and rejects a user without it', async () => {
    const vatUpdateHandler = Object.getOwnPropertyDescriptor(InventoryController.prototype, 'updateCategoryVat')?.value;
    const context = {
      getHandler: () => vatUpdateHandler,
      getClass: () => InventoryController,
      switchToHttp: () => ({ getRequest: () => ({ user: { id: 'user-1' } }) }),
    } as unknown as ExecutionContext;
    const access = { getPermissionKeys: vi.fn() };
    const guard = new PermissionsGuard(new Reflector(), access as never);

    access.getPermissionKeys.mockResolvedValue(new Set(['inventory:configure-vat']));
    await expect(guard.canActivate(context)).resolves.toBe(true);

    access.getPermissionKeys.mockResolvedValue(new Set(['inventory:read']));
    await expect(guard.canActivate(context)).rejects.toMatchObject({ statusCode: 403 });
  });
});
