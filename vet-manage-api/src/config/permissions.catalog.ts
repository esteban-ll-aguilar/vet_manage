export type PermissionDefinition = {
  key: `${string}:${string}`;
  displayName: string;
  description: string;
  visible?: boolean;
};

export const PERMISSIONS: readonly PermissionDefinition[] = [
  ['users:read', 'Ver usuarios'],
  ['users:create', 'Crear usuarios'],
  ['users:update', 'Actualizar usuarios'],
  ['users:delete', 'Desactivar usuarios'],
  ['roles:read', 'Ver roles'],
  ['roles:create', 'Crear roles'],
  ['roles:update', 'Actualizar roles'],
  ['roles:assign', 'Asignar roles a usuarios'],
  ['permissions:read', 'Ver permisos'],
  ['pets:read', 'Ver mascotas'],
  ['pets:create', 'Registrar mascotas'],
  ['pets:update', 'Actualizar mascotas'],
  ['appointments:read', 'Ver citas'],
  ['appointments:create', 'Crear citas'],
  ['appointments:update', 'Actualizar citas'],
  ['medical-records:read', 'Ver historias clínicas'],
  ['medical-records:create', 'Crear historias clínicas'],
  ['medical-records:update', 'Actualizar historias clínicas'],
].map(([key, displayName]) => ({
  key: key as PermissionDefinition['key'],
  displayName,
  description: `Permiso de Vet Manage: ${key}`,
  visible: true,
}));
