import { PERMISSIONS, type PermissionKey } from './permissions.catalog.js';

export type RoleDefinition = {
  name: string;
  displayName: string;
  description: string;
  category: 'SYSTEM' | 'STAFF' | 'CLIENT';
  visible?: boolean;
  permissions: readonly PermissionKey[];
};

const crud = (module: string) => [
  `${module}:create`, `${module}:read`, `${module}:update`,
] as PermissionKey[];

const clientsAndPetsFull: PermissionKey[] = [
  ...crud('clients'), 'clients:deactivate', 'clients:inactivate', 'clients:activate',
  ...crud('pets'), 'pets:deactivate', 'pets:inactivate', 'pets:activate',
];

const catalogManagement = (module: 'species' | 'breeds'): PermissionKey[] => [
  `${module}:create`, `${module}:read`, `${module}:update`, `${module}:change-status`,
];

const preventiveCare: PermissionKey[] = [
  'vaccinations:create', 'vaccinations:update', 'vaccinations:read', 'vaccinations:void',
  'deworming:create', 'deworming:update', 'deworming:read', 'deworming:void',
];

const procedureCatalog: PermissionKey[] = [
  'procedure-types:create', 'procedure-types:read', 'procedure-types:inactivate',
  'procedures:create', 'procedures:read', 'procedures:deactivate',
];

const clinicalFiles: PermissionKey[] = [
  'clinical-files:create', 'clinical-files:read', 'clinical-files:update', 'clinical-files:remove',
];

// Configuración de la agenda: jornadas, turnos de sábado, bloqueos y tarifas.
const schedulingAdmin: PermissionKey[] = [
  'branches:read',
  'work-schedules:read', 'work-schedules:manage',
  'saturday-shifts:read', 'saturday-shifts:manage',
  'daily-availability:read',
  'schedule-blocks:read', 'schedule-blocks:create', 'schedule-blocks:remove',
  'rates:read', 'rates:manage',
  'resources:read-availability',
];

// Permisos iniciales de cada rol. El superadmin es una cuenta interna para pruebas.
export const ROLES: readonly RoleDefinition[] = [
  {
    name: 'superadmin',
    displayName: 'Superadministrador (pruebas)',
    description: 'Cuenta interna de pruebas con todos los permisos del sistema.',
    category: 'SYSTEM',
    visible: false,
    permissions: PERMISSIONS.map(({ key }) => key),
  },
  {
    name: 'administrator',
    displayName: 'Administrador',
    description: 'Gestiona usuarios, roles, permisos, auditoría y la configuración de la agenda.',
    category: 'STAFF',
    permissions: [
      'users:create', 'users:read', 'users:update', 'users:assign-roles',
      'users:change-status', 'users:deactivate',
      'roles:manage-permissions', 'audit:read', 'audit:export',
      'inventory:read',
      ...catalogManagement('species'),
      ...catalogManagement('breeds'),
      ...schedulingAdmin,
    ],
  },
  {
    name: 'manager',
    displayName: 'Gerente',
    description: 'Gestiona clientes, pacientes, catálogos de procedimientos y la configuración de la agenda.',
    category: 'STAFF',
    permissions: [
      ...clientsAndPetsFull,
      'species:read', 'breeds:read',
      'inventory:read', 'inventory:manage-products', 'inventory:manage-categories', 'inventory:manage-brands',
      ...procedureCatalog,
      ...schedulingAdmin,
    ],
  },
  {
    name: 'veterinarian',
    displayName: 'Veterinario',
    description: 'Atiende pacientes y gestiona su historia clínica.',
    category: 'STAFF',
    permissions: [
      ...clientsAndPetsFull.filter((key) => key !== 'pets:inactivate' && key !== 'pets:activate'),
      ...catalogManagement('species'),
      ...catalogManagement('breeds'),
      'inventory:read',
      'medical-history:create', 'medical-history:read',
      'consultations:create', 'consultations:correct', 'diagnoses:create',
      'prescriptions:manage', 'prescriptions:read', 'prescriptions:export',
      ...preventiveCare,
      ...procedureCatalog,
      'procedure-reports:create', 'procedure-reports:correct',
      'supplies-used:create', 'supplies-used:remove',
      ...clinicalFiles,
      // Agenda: consulta su jornada y registra su disponibilidad diaria.
      'branches:read', 'work-schedules:read', 'saturday-shifts:read',
      'daily-availability:read', 'daily-availability:manage-own', 'schedule-blocks:read',
    ],
  },
  {
    name: 'veterinary_technician',
    displayName: 'Técnico Veterinario',
    description: 'Apoya la atención: vacunación, desparasitación, informes y archivos.',
    category: 'STAFF',
    permissions: [
      'clients:read', 'pets:read', 'species:read', 'breeds:read',
      'medical-history:read',
      ...preventiveCare,
      'procedure-types:read', 'procedures:read', 'procedure-reports:create',
      'supplies-used:create',
      ...clinicalFiles,
    ],
  },
  {
    name: 'receptionist',
    displayName: 'Recepcionista',
    description: 'Registra y consulta clientes y pacientes.',
    category: 'STAFF',
    permissions: [
      'clients:create', 'clients:read', 'clients:update', 'clients:inactivate', 'clients:activate',
      'pets:create', 'pets:read', 'pets:update', 'pets:inactivate', 'pets:activate',
      'species:read', 'breeds:read',
      // Agenda: consulta recursos disponibles y tarifas.
      'branches:read', 'resources:read-availability', 'rates:read',
      'work-schedules:read', 'schedule-blocks:read',
    ],
  },
  {
    name: 'cashier',
    displayName: 'Cajero',
    description: 'Gestiona cobros. Sus permisos se definen en el módulo de ventas.',
    category: 'STAFF',
    permissions: ['inventory:read'],
  },
  {
    name: 'warehouse_keeper',
    displayName: 'Bodeguero',
    description: 'Gestiona inventario. Sus permisos se definen en el módulo de inventario.',
    category: 'STAFF',
    permissions: ['inventory:read', 'inventory:manage-products', 'inventory:manage-categories', 'inventory:manage-brands', 'inventory:register-entry'],
  },
  {
    name: 'client',
    displayName: 'Cliente',
    description: 'Propietario de pacientes con cuenta en el sistema.',
    category: 'CLIENT',
    permissions: [],
  },
];
