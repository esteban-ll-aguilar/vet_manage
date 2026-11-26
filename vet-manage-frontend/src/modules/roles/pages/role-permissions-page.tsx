import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useBlocker } from 'react-router-dom';
import { ApiError } from '../../../infrastructure/api/http-client';
import { useToast } from '../../../common/components/toast-context';
import { rolesApi } from '../services/roles-api';
import type { ManagedPermission, RolePermissionsCatalog } from '../types';
import './role-permissions-page.css';

const UNSAVED_CHANGES_MESSAGE = 'Tiene cambios sin guardar. ¿Desea salir?';
const ADMINISTRATOR_PERMISSION_MESSAGE = 'No se puede retirar este permiso al rol Administrador';

const MODULE_LABELS: Record<string, string> = {
  audit: 'Auditoría',
  branches: 'Sucursales',
  'clinical-files': 'Archivos clínicos',
  clients: 'Clientes',
  consultations: 'Atención clínica',
  deworming: 'Desparasitaciones',
  'daily-availability': 'Disponibilidad diaria',
  diagnoses: 'Diagnósticos',
  inventory: 'Inventario',
  'medical-history': 'Historia clínica',
  pets: 'Pacientes',
  'procedure-reports': 'Informes de procedimientos',
  'procedure-types': 'Tipos de procedimiento',
  procedures: 'Procedimientos',
  prescriptions: 'Recetas',
  rates: 'Tarifas',
  resources: 'Recursos',
  roles: 'Permisos por rol',
  'schedule-blocks': 'Bloqueos de horario',
  'saturday-shifts': 'Turnos de sábado',
  species: 'Especies',
  suppliers: 'Proveedores',
  'supplies-used': 'Insumos utilizados',
  users: 'Usuarios',
  vaccinations: 'Vacunaciones',
  'work-schedules': 'Horarios de atención',
};

function sameKeys(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((key) => rightSet.has(key));
}

function groupPermissions(permissions: ManagedPermission[]) {
  const groups = new Map<string, ManagedPermission[]>();
  for (const permission of permissions) {
    const group = groups.get(permission.module) ?? [];
    group.push(permission);
    groups.set(permission.module, group);
  }
  return [...groups.entries()].map(([module, items]) => ({
    module,
    label: MODULE_LABELS[module] ?? module,
    permissions: items,
  }));
}

export function RolePermissionsPage() {
  const { showToast } = useToast();
  const [catalog, setCatalog] = useState<RolePermissionsCatalog | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedPermissionKeys, setSelectedPermissionKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRole = catalog?.roles.find((role) => role.id === selectedRoleId) ?? null;
  const isDirty = selectedRole !== null && !sameKeys(selectedPermissionKeys, selectedRole.permissionKeys);
  const blocker = useBlocker(useCallback(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname,
    [isDirty],
  ));
  const protectedKeys = useMemo(
    () => new Set(catalog?.protectedPermissionKeys ?? []),
    [catalog?.protectedPermissionKeys],
  );
  const permissionGroups = useMemo(
    () => groupPermissions(catalog?.permissions ?? []),
    [catalog?.permissions],
  );

  useEffect(() => {
    let cancelled = false;
    rolesApi.permissionCatalog()
      .then((response) => {
        if (cancelled) return;
        const firstRole = response.roles[0];
        setCatalog(response);
        if (firstRole) {
          setSelectedRoleId(firstRole.id);
          setSelectedPermissionKeys(firstRole.permissionKeys);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los permisos por rol.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isDirty) return;
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = UNSAVED_CHANGES_MESSAGE;
    };
    window.addEventListener('beforeunload', preventUnload);
    return () => window.removeEventListener('beforeunload', preventUnload);
  }, [isDirty]);

  function selectRole(roleId: string) {
    const role = catalog?.roles.find((item) => item.id === roleId);
    if (!role) return;
    setSelectedRoleId(role.id);
    setSelectedPermissionKeys(role.permissionKeys);
  }

  function togglePermission(permissionKey: string) {
    const isCurrentlyGranted = selectedPermissionKeys.includes(permissionKey);
    if (
      selectedRole?.name === 'administrator'
      && isCurrentlyGranted
      && protectedKeys.has(permissionKey)
    ) {
      showToast(ADMINISTRATOR_PERMISSION_MESSAGE, 'error');
      return;
    }

    setSelectedPermissionKeys((current) =>
      isCurrentlyGranted
        ? current.filter((key) => key !== permissionKey)
        : [...current, permissionKey].sort(),
    );
  }

  function discardChanges() {
    if (selectedRole) setSelectedPermissionKeys(selectedRole.permissionKeys);
  }

  async function savePermissions() {
    if (!selectedRole || !isDirty || saving) return;
    setSaving(true);
    try {
      const updatedRole = await rolesApi.updatePermissions(selectedRole.id, selectedPermissionKeys);
      setCatalog((current) => current && ({
        ...current,
        roles: current.roles.map((role) => role.id === updatedRole.id ? updatedRole : role),
      }));
      setSelectedPermissionKeys(updatedRole.permissionKeys);
      showToast('Permisos del rol actualizados correctamente', 'success');
    } catch (cause) {
      showToast(cause instanceof ApiError ? cause.message : 'No se pudieron actualizar los permisos.', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <section className="role-permissions-page"><div className="empty-state">Cargando permisos…</div></section>;
  }

  if (error || !catalog || !selectedRole) {
    return (
      <section className="role-permissions-page">
        <Link className="back-link" to="/">← Salir</Link>
        <div className="inline-notice inline-notice--error" role="alert">
          {error ?? 'No hay roles disponibles para gestionar.'}
        </div>
      </section>
    );
  }

  return (
    <section className="role-permissions-page">
      <Link className="back-link" to="/">← Salir</Link>
      <header className="page-heading">
        <div>
          <span className="eyebrow">Administración · Roles</span>
          <h2>Gestionar permisos por rol</h2>
          <p>Active o retire permisos para controlar las funciones disponibles en cada rol.</p>
        </div>
      </header>

      <div className="role-permissions-toolbar">
        <label className="role-permissions-toolbar__role">
          Rol
          <select
            aria-label="Seleccionar rol"
            value={selectedRoleId}
            onChange={(event) => selectRole(event.target.value)}
            disabled={isDirty || saving}
          >
            {catalog.roles.map((role) => (
              <option key={role.id} value={role.id}>{role.displayName}</option>
            ))}
          </select>
        </label>
        {isDirty && <p role="status">Tienes cambios sin guardar. Guarda o descarta los cambios antes de elegir otro rol.</p>}
      </div>

      <div className="role-permissions-groups">
        {permissionGroups.map((group) => (
          <section className="role-permissions-card" key={group.module} aria-labelledby={`permission-group-${group.module}`}>
            <header>
              <h3 id={`permission-group-${group.module}`}>{group.label}</h3>
              <span>{group.permissions.length} permisos</span>
            </header>
            <ul>
              {group.permissions.map((permission) => {
                const checked = selectedPermissionKeys.includes(permission.key);
                const protectedForAdministrator =
                  selectedRole.name === 'administrator' && protectedKeys.has(permission.key);
                return (
                  <li key={permission.key}>
                    <label className="role-permission-option">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={saving}
                        onChange={() => togglePermission(permission.key)}
                        aria-label={permission.displayName}
                      />
                      <span>
                        <strong>{permission.displayName}</strong>
                        <small>
                          {permission.key}
                          {protectedForAdministrator ? ' · Protegido para el Administrador' : ''}
                        </small>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <div className="role-permissions-actions">
        <button type="button" className="button button--ghost" onClick={discardChanges} disabled={!isDirty || saving}>
          Descartar cambios
        </button>
        <button type="button" className="button button--primary" onClick={() => void savePermissions()} disabled={!isDirty || saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      {blocker.state === 'blocked' && (
        <div className="modal-overlay" role="presentation">
          <div className="modal-card role-permissions-confirm" role="alertdialog" aria-modal="true" aria-labelledby="unsaved-permissions-title">
            <h3 id="unsaved-permissions-title">Cambios sin guardar</h3>
            <p>{UNSAVED_CHANGES_MESSAGE}</p>
            <div className="role-permissions-actions">
              <button type="button" className="button button--ghost" onClick={() => blocker.reset()}>
                Permanecer
              </button>
              <button type="button" className="button button--danger" onClick={() => blocker.proceed()}>
                Salir sin guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
