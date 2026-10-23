import type { PermissionDefinition } from './permissions.catalog.js';

export type RoleDefinition = {
  name: string;
  displayName: string;
  description: string;
  category: 'SYSTEM' | 'STAFF' | 'CLIENT';
  visible?: boolean;
  allPermissions?: boolean;
  permissions: readonly PermissionDefinition['key'][];
};

const all = [] as PermissionDefinition['key'][];

export const ROLES: readonly RoleDefinition[] = [
  {
    name: 'super_admin',
    displayName: 'Super Administrador',
    description: 'Acceso total a los permisos activos del sistema.',
    category: 'SYSTEM',
    visible: false,
    allPermissions: true,
    permissions: all,
  },
  {
    name: 'administrator',
    displayName: 'Administrador',
    description: 'Gestiona la operación y el equipo de la clínica.',
    category: 'STAFF',
    permissions: [
      'users:read', 'users:create', 'users:update', 'users:delete',
      'roles:read', 'roles:create', 'roles:update', 'roles:assign', 'permissions:read',
      'pets:read', 'pets:create', 'pets:update',
      'appointments:read', 'appointments:create', 'appointments:update',
      'medical-records:read', 'medical-records:create', 'medical-records:update',
    ],
  },
  {
    name: 'veterinarian',
    displayName: 'Veterinario',
    description: 'Gestiona pacientes, citas e historias clínicas.',
    category: 'STAFF',
    permissions: [
      'pets:read', 'pets:create', 'pets:update',
      'appointments:read', 'appointments:create', 'appointments:update',
      'medical-records:read', 'medical-records:create', 'medical-records:update',
    ],
  },
  {
    name: 'receptionist',
    displayName: 'Recepcionista',
    description: 'Gestiona clientes, pacientes y agenda.',
    category: 'STAFF',
    permissions: [
      'pets:read', 'pets:create', 'pets:update',
      'appointments:read', 'appointments:create', 'appointments:update',
    ],
  },
];
