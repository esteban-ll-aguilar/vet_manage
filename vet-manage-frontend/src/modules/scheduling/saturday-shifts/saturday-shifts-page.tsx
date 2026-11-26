import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/auth-context';
import { useToast } from '../../../common/components/toast-context';
import { ApiError } from '../../../infrastructure/api/http-client';
import { schedulingApi } from '../services/scheduling-api';
import type { Branch, SaturdayShift, VeterinarianOption } from '../types';
import './saturday-shifts.css';

const formatDate = (date: string) => date.split('-').reverse().join('/');

export function SaturdayShiftsPage() {
  const { hasPermission } = useAuth();
  const { showToast } = useToast();
  const canManage = hasPermission('saturday-shifts:manage');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [veterinarians, setVeterinarians] = useState<VeterinarianOption[]>([]);
  const [shifts, setShifts] = useState<SaturdayShift[]>([]);
  const [sucursalId, setSucursalId] = useState('');
  const [fechas, setFechas] = useState(['2026-11-07', '2026-11-14', '2026-11-21']);
  const [veterinarioIds, setVeterinarioIds] = useState<string[]>([]);
  const [substituteId, setSubstituteId] = useState('');
  const [replacementId, setReplacementId] = useState('');
  const [justificacion, setJustificacion] = useState('');

  const load = useCallback(async () => {
    try {
      setShifts(await schedulingApi.listSaturdayShifts(sucursalId ? { sucursalId } : undefined));
    } catch (cause) {
      showToast(cause instanceof ApiError ? cause.message : 'No se pudieron cargar los turnos.', 'error');
    }
  }, [sucursalId, showToast]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load();
    }, 0);
    Promise.all([schedulingApi.listBranches(), schedulingApi.listVeterinarians()])
      .then(([loadedBranches, loadedVeterinarians]) => {
        setBranches(loadedBranches);
        setVeterinarians(loadedVeterinarians);
      })
      .catch((cause) => showToast(cause instanceof ApiError ? cause.message : 'No se pudieron cargar los datos.', 'error'));
    return () => window.clearTimeout(timeout);
  }, [load, showToast]);

  async function generate() {
    if (!sucursalId || veterinarioIds.length === 0) {
      showToast('Sucursal y veterinarios elegibles son obligatorios.', 'error');
      return;
    }
    const fechasValidas = fechas.filter(Boolean);
    if (fechasValidas.length === 0) {
      showToast('Debes agregar al menos una fecha de sábado.', 'error');
      return;
    }
    try {
      await schedulingApi.generateSaturdayShifts({
        sucursalId,
        fechas: fechasValidas,
        veterinarioIds,
      });
      showToast('Turnos de sábado generados correctamente', 'success');
      await load();
    } catch (cause) {
      showToast(cause instanceof ApiError ? cause.message : 'No se pudieron generar los turnos.', 'error');
    }
  }

  async function substitute() {
    if (!substituteId || !replacementId || !justificacion.trim()) {
      showToast('Turno, reemplazo y justificación son obligatorios.', 'error');
      return;
    }
    try {
      await schedulingApi.substituteSaturdayShift(substituteId, {
        veterinarioId: replacementId,
        justificacion: justificacion.trim(),
      });
      showToast('Turno sustituido correctamente', 'success');
      setSubstituteId('');
      setReplacementId('');
      setJustificacion('');
      await load();
    } catch (cause) {
      showToast(cause instanceof ApiError ? cause.message : 'No se pudo sustituir el turno.', 'error');
    }
  }

  return (
    <section className="inventory-page saturday-shifts-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Agenda · Sábados</span>
          <h2>Turnos de sábado</h2>
          <p>Rotación por sucursal y sustituciones justificadas.</p>
        </div>
      </div>

      <div className="saturday-shifts-panels">
        {canManage && (
          <div className="catalog-card saturday-shifts-card">
            <div className="catalog-card__heading"><div><span className="eyebrow">Planificación</span><h3>Generar rotación</h3><p>Organiza la atención de los próximos sábados.</p></div></div>
            <div className="saturday-shifts-form">
              <label className="field"><span>Sucursal</span><select value={sucursalId} onChange={(event) => setSucursalId(event.target.value)}><option value="">Seleccione</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.nombre}</option>)}</select></label>
              <fieldset className="field saturday-shifts-dates">
                <legend>Fechas de los sábados</legend>
                <div className="saturday-shifts-date-fields">
                  {fechas.map((fecha, index) => (
                    <div className="saturday-shifts-date-field" key={index}>
                      <label htmlFor={`saturday-date-${index}`}>Sábado {index + 1}</label>
                      <input
                        id={`saturday-date-${index}`}
                        type="date"
                        value={fecha}
                        aria-describedby="saturday-dates-help"
                        onChange={(event) => {
                          const newDate = event.target.value;
                          setFechas((current) => {
                            const updated = [...current];
                            updated[index] = newDate;
                            return updated;
                          });
                        }}
                      />
                      <button
                        type="button"
                        className="button button--ghost button--small"
                        aria-label={`Eliminar sábado ${index + 1}`}
                        onClick={() => setFechas((current) => current.filter((_, i) => i !== index))}
                      >
                        Eliminar
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setFechas((current) => [...current, ''])}
                >
                  Agregar fecha
                </button>
                <small id="saturday-dates-help">Selecciona cada sábado en el calendario.</small>
              </fieldset>
              <div className="saturday-shifts-vets">
                <label className="field" htmlFor="saturday-veterinarian-selector">
                  <span>Veterinarios de la rotación</span>
                  <select
                    id="saturday-veterinarian-selector"
                    value=""
                    aria-label="Veterinarios de la rotación"
                    onChange={(event) => {
                      const id = event.target.value;
                      if (id) setVeterinarioIds((current) => current.includes(id) ? current : [...current, id]);
                    }}
                  >
                    <option value="">Agregar veterinario</option>
                    {veterinarians.filter((vet) => !veterinarioIds.includes(vet.id)).map((vet) => (
                      <option key={vet.id} value={vet.id}>{vet.person.firstName} {vet.person.lastName}</option>
                    ))}
                  </select>
                  <small id="saturday-vets-help">Agrega los veterinarios en el orden en que atenderán. Puedes quitar un nombre y agregarlo nuevamente al final.</small>
                </label>
                {veterinarioIds.length > 0 ? (
                  <ol className="saturday-shifts-vets__list" aria-label="Orden de rotación">
                    {veterinarioIds.map((id) => {
                      const vet = veterinarians.find((item) => item.id === id);
                      const name = vet ? `${vet.person.firstName} ${vet.person.lastName}` : 'Veterinario seleccionado';
                      return (
                        <li key={id}>
                          <span>{name}</span>
                          <button type="button" className="button button--ghost button--small" aria-label={`Quitar a ${name} de la rotación`} onClick={() => setVeterinarioIds((current) => current.filter((item) => item !== id))}>Quitar</button>
                        </li>
                      );
                    })}
                  </ol>
                ) : <p className="saturday-shifts-vets__empty">Todavía no has agregado veterinarios.</p>}
              </div>
              <div className="saturday-shifts-form__actions"><button type="button" className="button button--primary" onClick={generate}>Generar y guardar</button></div>
            </div>
          </div>
        )}

        {canManage && (
          <div className="catalog-card saturday-shifts-card">
            <div className="catalog-card__heading"><div><span className="eyebrow">Ajustes de turno</span><h3>Sustituir veterinario</h3><p>Selecciona un reemplazo e indica el motivo del cambio.</p></div></div>
            <div className="saturday-shifts-form">
              <label className="field"><span>Turno</span><select value={substituteId} onChange={(event) => setSubstituteId(event.target.value)}><option value="">Seleccione</option>{shifts.map((shift) => <option key={shift.id} value={shift.id}>{formatDate(shift.fecha)} · {shift.sucursalNombre} · {shift.veterinarioNombre}</option>)}</select></label>
              <label className="field"><span>Reemplazo</span><select value={replacementId} onChange={(event) => setReplacementId(event.target.value)}><option value="">Seleccione</option>{veterinarians.map((veterinarian) => <option key={veterinarian.id} value={veterinarian.id}>{veterinarian.person.firstName} {veterinarian.person.lastName}</option>)}</select></label>
              <label className="field"><span>Justificación</span><textarea rows={3} value={justificacion} onChange={(event) => setJustificacion(event.target.value)} placeholder="Describe el motivo de la sustitución" /></label>
              <div className="saturday-shifts-form__actions"><button type="button" className="button button--secondary" onClick={substitute}>Sustituir veterinario</button></div>
            </div>
          </div>
        )}

      </div>

      <div className="catalog-card saturday-shifts-card">
        <div className="catalog-card__heading"><div><h3>Turnos registrados</h3><p>Asignaciones de atención por sucursal.</p></div><span className="saturday-shifts-count">{shifts.length} turno{shifts.length === 1 ? '' : 's'}</span></div>
        {shifts.length === 0 ? <div className="empty-state"><span className="saturday-shifts-empty-icon" aria-hidden="true">◷</span><strong>No hay turnos registrados</strong><span>Las asignaciones aparecerán aquí cuando se genere una rotación.</span></div> : (
          <div className="product-table-wrap">
            <table className="product-table saturday-shifts-table" aria-label="Turnos de sábado">
              <thead><tr><th>Fecha</th><th>Sucursal</th><th>Veterinario</th><th>Jornada</th><th>Justificación</th></tr></thead>
              <tbody>{shifts.map((shift) => <tr key={shift.id}><td><span className="saturday-shifts-date">{formatDate(shift.fecha)}</span></td><td>{shift.sucursalNombre}</td><td><strong>{shift.veterinarioNombre}</strong></td><td><span className="saturday-shifts-time">{shift.horaInicio}–{shift.horaFin}</span></td><td>{shift.justificacion ?? '—'}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
