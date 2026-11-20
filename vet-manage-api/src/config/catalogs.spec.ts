import { PERMISSIONS } from './permissions.catalog.js';
import { PERMISSION_CATALOGS } from './permissions.catalog.js';
import { ROLES } from './roles.catalog.js';

const keysOf = (roleName: string) =>
  new Set<string>(ROLES.find((role) => role.name === roleName)?.permissions ?? []);

describe('Catálogos de permisos y roles', () => {
  it('mantiene catálogos separados por módulo y los agrega en una colección plana', () => {
    expect(PERMISSION_CATALOGS).toHaveLength(4);
    expect(PERMISSION_CATALOGS.every((catalog) => catalog.length > 0)).toBe(true);
    expect(PERMISSIONS.length).toBe(PERMISSION_CATALOGS.reduce((total, catalog) => total + catalog.length, 0));
    expect(PERMISSIONS.some((permission) => permission.key === 'inventory:manage-products')).toBe(true);
  });

  it('no repite claves de permisos y todas siguen el formato modulo:accion', () => {
    const keys = PERMISSIONS.map((permission) => permission.key);

    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^[a-z-]+:[a-z-]+$/);
  });

  it('declara el superadmin de pruebas y los roles operativos', () => {
    expect(ROLES.map((role) => role.name)).toEqual([
      'superadmin', 'administrator', 'manager', 'veterinarian', 'veterinary_technician',
      'receptionist', 'cashier', 'warehouse_keeper', 'client',
    ]);
  });

  it('solo asigna permisos declarados en el catálogo', () => {
    const declared = new Set<string>(PERMISSIONS.map((permission) => permission.key));

    for (const role of ROLES) {
      for (const key of role.permissions) expect(declared.has(key), `${role.name}: ${key}`).toBe(true);
    }
  });

  it('el Administrador gestiona usuarios y auditoría pero no clientes ni pacientes', () => {
    const admin = keysOf('administrator');

    expect(admin.has('users:create')).toBe(true);
    expect(admin.has('roles:manage-permissions')).toBe(true);
    expect(admin.has('audit:export')).toBe(true);
    expect([...admin].some((key) => key.startsWith('clients:') || key.startsWith('pets:'))).toBe(false);
  });

  it('el superadmin tiene todos los permisos y no es visible para administración normal', () => {
    const superadmin = ROLES.find((role) => role.name === 'superadmin');

    expect(superadmin?.visible).toBe(false);
    expect(keysOf('superadmin')).toEqual(new Set(PERMISSIONS.map((permission) => permission.key)));
  });

  it('el Recepcionista no puede dar de baja clientes ni pacientes', () => {
    const receptionist = keysOf('receptionist');

    expect(receptionist.has('clients:create')).toBe(true);
    expect(receptionist.has('clients:inactivate')).toBe(true);
    expect(receptionist.has('clients:deactivate')).toBe(false);
    expect(receptionist.has('pets:deactivate')).toBe(false);
  });

  it('el Veterinario registra, actualiza y da de baja pacientes', () => {
    const veterinarian = keysOf('veterinarian');

    expect(veterinarian.has('pets:create')).toBe(true);
    expect(veterinarian.has('pets:update')).toBe(true);
    expect(veterinarian.has('pets:deactivate')).toBe(true);
    expect(veterinarian.has('pets:inactivate')).toBe(false);
  });

  it('el Técnico Veterinario registra informes pero no los corrige', () => {
    const technician = keysOf('veterinary_technician');

    expect(technician.has('procedure-reports:create')).toBe(true);
    expect(technician.has('procedure-reports:correct')).toBe(false);
    expect(technician.has('clients:read')).toBe(true);
    expect(technician.has('clients:create')).toBe(false);
  });

  it('Gerente y Bodeguero pueden gestionar el catálogo de inventario (HU-01)', () => {
    const catalogPermissions = [
      'inventory:manage-products', 'inventory:manage-categories', 'inventory:manage-brands',
    ];

    for (const role of ['manager', 'warehouse_keeper']) {
      const permissions = keysOf(role);
      expect(permissions.has('inventory:read'), role).toBe(true);
      for (const permission of catalogPermissions) expect(permissions.has(permission), `${role}: ${permission}`).toBe(true);
    }
  });

  it('Administrador y Gerente configuran la agenda', () => {
    for (const name of ['administrator', 'manager']) {
      const role = keysOf(name);
      for (const key of [
        'work-schedules:manage', 'saturday-shifts:manage', 'schedule-blocks:create',
        'schedule-blocks:remove', 'rates:manage', 'resources:read-availability',
      ]) expect(role.has(key), `${name}: ${key}`).toBe(true);
      expect(role.has('daily-availability:manage-own'), name).toBe(false);
    }
  });

  it('el Veterinario define solo su disponibilidad diaria y no configura la agenda', () => {
    const veterinarian = keysOf('veterinarian');

    expect(veterinarian.has('daily-availability:manage-own')).toBe(true);
    expect(veterinarian.has('work-schedules:read')).toBe(true);
    expect(veterinarian.has('work-schedules:manage')).toBe(false);
    expect(veterinarian.has('schedule-blocks:create')).toBe(false);
    expect(veterinarian.has('rates:manage')).toBe(false);
  });

  it('el Recepcionista consulta recursos disponibles pero no gestiona bloqueos ni tarifas', () => {
    const receptionist = keysOf('receptionist');

    expect(receptionist.has('resources:read-availability')).toBe(true);
    expect(receptionist.has('rates:read')).toBe(true);
    expect(receptionist.has('schedule-blocks:create')).toBe(false);
    expect(receptionist.has('rates:manage')).toBe(false);
  });

  it('el Bodeguero también registra entradas de lote (HU-02)', () => {
    expect(keysOf('warehouse_keeper').has('inventory:register-entry')).toBe(true);
    expect(keysOf('manager').has('inventory:register-entry')).toBe(false);
  });

  it('los actores de HU-12 pueden consultar alertas de inventario', () => {
    for (const name of ['manager', 'veterinarian', 'cashier', 'warehouse_keeper']) {
      expect(keysOf(name).has('inventory:read'), name).toBe(true);
    }
    expect(keysOf('client').size).toBe(0);
  });
});
