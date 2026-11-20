import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckIcon, ShieldIcon } from '../../../common/components/icons';
import { useToast } from '../../../common/components/toast-context';
import { ApiError } from '../../../infrastructure/api/http-client';
import { usersApi } from '../services/users-api';
import type { UserRoleAssignment } from '../types';
import './users-page.css';

const AT_LEAST_ONE = 'El usuario debe tener al menos un rol';

export function UserRoleAssignmentPage() {
  const { id = '' } = useParams();
  const { showToast } = useToast();
  const [data, setData] = useState<UserRoleAssignment | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) {
        setLoading(true);
        setError(null);
      }
    });
    usersApi
      .getRoleAssignment(id)
      .then((response) => {
        if (cancelled) return;
        setData(response);
        setSelected(response.currentRoles.map((role) => role.name));
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'No se pudo cargar la asignación de roles.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  function toggleRole(name: string) {
    setSelected((current) =>
      current.includes(name) ? current.filter((role) => role !== name) : [...current, name],
    );
  }

  async function save() {
    if (saving || !data) return;
    if (selected.length === 0) {
      showToast(AT_LEAST_ONE, 'error');
      return;
    }
    setSaving(true);
    try {
      const updated = await usersApi.updateRoleAssignment(id, selected);
      setData(updated);
      setSelected(updated.currentRoles.map((role) => role.name));
      showToast('Roles actualizados correctamente', 'success');
    } catch (cause) {
      if (cause instanceof ApiError) showToast(cause.message, 'error');
      else showToast('No se pudieron actualizar los roles.', 'error');
      try {
        const fresh = await usersApi.getRoleAssignment(id);
        setData(fresh);
        setSelected(fresh.currentRoles.map((role) => role.name));
      } catch {
        /* se mantiene el estado actual si no es posible refrescar */
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="users-page">
        <div className="catalog-card"><div className="empty-state">Cargando roles…</div></div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="users-page">
        <Link className="back-link" to="/users">← Volver a usuarios</Link>
        <div className="catalog-card">
          <div className="inline-notice inline-notice--error" role="alert">{error ?? 'No se pudo cargar la información.'}</div>
        </div>
      </section>
    );
  }

  return (
    <section className="users-page">
      <Link className="back-link" to="/users">← Volver a usuarios</Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Administración · Usuarios</span>
          <h2>Gestionar roles</h2>
          <p>Asigne o quite roles a <strong>{data.user.fullName}</strong>.</p>
        </div>
      </div>

      <div className="register-form">
        <div className="register-form__grid">
          <div className="register-card">
            <header className="register-card__header">
              <span className="register-card__icon"><ShieldIcon size={18} /></span>
              <div><h3>Roles actuales</h3><p>Roles vigentes de la cuenta.</p></div>
            </header>
            {data.currentRoles.length === 0 ? (
              <p className="role-list__status">El usuario no tiene roles vigentes.</p>
            ) : (
              <ul className="role-current-list" aria-label="Roles actuales">
                {data.currentRoles.map((role) => (
                  <li key={role.name} className="role-current-item">
                    <label className={`role-card${selectedSet.has(role.name) ? ' role-card--selected' : ''}`}>
                      <input
                        className="sr-only"
                        type="checkbox"
                        checked={selectedSet.has(role.name)}
                        onChange={() => toggleRole(role.name)}
                        aria-label={`Quitar rol ${role.displayName}`}
                      />
                      <span className="role-card__icon"><ShieldIcon size={18} /></span>
                      <span className="role-card__text"><b>{role.displayName}</b><small>Asignado actualmente</small></span>
                      <span className="role-card__check" aria-hidden="true"><CheckIcon size={13} /></span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="register-card">
            <header className="register-card__header">
              <span className="register-card__icon"><ShieldIcon size={18} /></span>
              <div><h3>Roles disponibles</h3><p>Solo se muestran roles que aún no están asignados.</p></div>
            </header>
            {data.availableRoles.length === 0 ? (
              <p className="role-list__status">No hay roles disponibles para asignar.</p>
            ) : (
              <fieldset className="role-list">
                <legend className="sr-only">Roles disponibles</legend>
                {data.availableRoles.map((role) => {
                  const checked = selectedSet.has(role.name);
                  return (
                    <label key={role.name} className={`role-card${checked ? ' role-card--selected' : ''}`}>
                      <input
                        className="sr-only"
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRole(role.name)}
                        aria-label={`Asignar rol ${role.displayName}`}
                      />
                      <span className="role-card__icon"><ShieldIcon size={18} /></span>
                      <span className="role-card__text"><b>{role.displayName}</b></span>
                      <span className="role-card__check" aria-hidden="true"><CheckIcon size={13} /></span>
                    </label>
                  );
                })}
              </fieldset>
            )}
          </div>
        </div>

        <div className="register-form__actions">
          <Link className="button button--ghost" to="/users">Cancelar</Link>
          <button className="button button--primary" type="button" onClick={() => void save()} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </section>
  );
}
