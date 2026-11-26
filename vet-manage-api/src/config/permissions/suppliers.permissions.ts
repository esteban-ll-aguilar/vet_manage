import type { PermissionDefinition } from '../permissions.catalog.js';

const define = (entries: readonly [PermissionDefinition['key'], string][]): readonly PermissionDefinition[] =>
  entries.map(([key, displayName]) => ({ key, displayName, description: `Permite: ${displayName.toLowerCase()}`, visible: true }));

export const SUPPLIERS_PERMISSIONS = define([
  ['suppliers:create', 'Registrar proveedores'],
  ['suppliers:read', 'Consultar proveedores'],
  ['suppliers:update', 'Actualizar proveedores'],
  ['suppliers:deactivate', 'Desactivar proveedores'],
]);
