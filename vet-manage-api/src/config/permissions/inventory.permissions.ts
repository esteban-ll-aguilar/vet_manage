import type { PermissionDefinition } from '../permissions.catalog.js';

const define = (entries: readonly [PermissionDefinition['key'], string][]): readonly PermissionDefinition[] => entries.map(([key, displayName]) => ({ key, displayName, description: `Permite: ${displayName.toLowerCase()}`, visible: true }));

export const INVENTORY_PERMISSIONS = define([
  ['inventory:read', 'Consultar inventario'],
  ['inventory:configure-vat', 'Configurar IVA por categoría'],
  ['inventory:manage-products', 'Gestionar productos'],
  ['inventory:manage-categories', 'Gestionar categorías'],
  ['inventory:manage-brands', 'Gestionar marcas'],
  ['inventory:register-entry', 'Registrar entradas de inventario'],
  ['inventory:register-exit', 'Registrar salidas de inventario'],
  ['inventory:adjust-stock', 'Ajustar existencias'],
  ['inventory:read-reports', 'Consultar reportes de inventario'],
]);
