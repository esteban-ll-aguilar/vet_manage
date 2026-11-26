import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../../../common/components/toast-context';
import { ApiError } from '../../../infrastructure/api/http-client';
import { schedulingApi } from '../services/scheduling-api';
import type { MyAvailability, MyAvailabilityJornada } from '../types';
import './my-availability.css';

// Horas de 00:00 a 23:30 cada 30 minutos, igual que el resto de la agenda.
const SLOT_OPTIONS = Array.from({ length: 48 }, (_, index) =>
  `${String(Math.floor(index / 2)).padStart(2, '0')}:${index % 2 === 0 ? '00' : '30'}`);

type DraftSlot = { horaInicio: string; horaFin: string };
type Problem = { message: string; details: string[] } | null;

const EMPTY_SLOT: DraftSlot = { horaInicio: '', horaFin: '' };

function todayValue(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function toDraft(jornada: MyAvailabilityJornada | undefined): DraftSlot[] {
  return jornada?.franjas.map((franja) => ({
    horaInicio: franja.horaInicio,
    horaFin: franja.horaFin,
  })) ?? [];
}

export function MyAvailabilityPage() {
  const { showToast } = useToast();

  const [fecha, setFecha] = useState(todayValue);
  const [availability, setAvailability] = useState<MyAvailability | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [slots, setSlots] = useState<DraftSlot[]>([]);
  const [newSlot, setNewSlot] = useState<DraftSlot>(EMPTY_SLOT);
  const [slotError, setSlotError] = useState('');
  const [problem, setProblem] = useState<Problem>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (preserveId?: string) => {
    setLoading(true);
    setError('');
    setProblem(null);
    setSlotError('');
    try {
      const result = await schedulingApi.getMyAvailability(fecha);
      setAvailability(result);
      const selected = result.jornadas.find((jornada) => jornada.horarioBaseId === preserveId)
        ?? result.jornadas[0];
      setSelectedId(selected?.horarioBaseId ?? '');
      setSlots(toDraft(selected));
    } catch (cause) {
      setAvailability(null);
      setSelectedId('');
      setSlots([]);
      setError(cause instanceof ApiError ? cause.message : 'No se pudo cargar la disponibilidad.');
    } finally {
      setLoading(false);
    }
  }, [fecha]);

  useEffect(() => {
    void load();
  }, [load]);

  const jornadas = availability?.jornadas ?? [];
  const selected = jornadas.find((jornada) => jornada.horarioBaseId === selectedId);

  function changeFecha(value: string) {
    setFecha(value);
  }

  function changeJornada(horarioBaseId: string) {
    setSelectedId(horarioBaseId);
    setSlots(toDraft(jornadas.find((jornada) => jornada.horarioBaseId === horarioBaseId)));
    setProblem(null);
    setSlotError('');
  }

  function addSlot() {
    if (!newSlot.horaInicio || !newSlot.horaFin) {
      setSlotError('Ingrese la hora de inicio y la hora de fin');
      return;
    }
    if (newSlot.horaFin <= newSlot.horaInicio) {
      setSlotError('La hora de fin debe ser posterior a la hora de inicio');
      return;
    }
    // Misma regla que la API: la franja no puede salir de la jornada autorizada.
    if (selected && (newSlot.horaInicio < selected.horaInicio || newSlot.horaFin > selected.horaFin)) {
      setSlotError('La disponibilidad diaria debe estar dentro del horario base');
      return;
    }
    setSlots((current) => [...current, newSlot].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)));
    setNewSlot(EMPTY_SLOT);
    setSlotError('');
    setProblem(null);
  }

  function removeSlot(index: number) {
    setSlots((current) => current.filter((_, position) => position !== index));
    setProblem(null);
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    setProblem(null);
    try {
      await schedulingApi.saveMyAvailability({
        fecha,
        horarioBaseId: selected.horarioBaseId,
        franjas: slots,
      });
      showToast('Disponibilidad guardada correctamente', 'success');
      await load(selected.horarioBaseId);
    } catch (cause) {
      // Las citas afectadas vuelven en `errors` y se muestran junto al mensaje.
      const apiError = cause as { message?: string; errors?: string[] };
      const nextProblem = {
        message: apiError.message ?? 'No se pudo guardar la disponibilidad.',
        details: apiError.errors ?? [],
      };
      // El cambio no se guardó: se recarga la disponibilidad anterior y luego se
      // vuelve a mostrar el motivo para no dejar en pantalla datos que no existen.
      await load(selected.horarioBaseId);
      setProblem(nextProblem);
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!selected) return;
    setSaving(true);
    setProblem(null);
    try {
      await schedulingApi.resetMyAvailability(fecha, selected.horarioBaseId);
      showToast('Jornada restablecida', 'success');
      await load(selected.horarioBaseId);
    } catch (cause) {
      const apiError = cause as { message?: string; errors?: string[] };
      setProblem({
        message: apiError.message ?? 'No se pudo restablecer la jornada.',
        details: apiError.errors ?? [],
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="inventory-page work-schedules-page my-availability-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Agenda · Mi disponibilidad</span>
          <h2>Mi disponibilidad diaria</h2>
          <p>Ajusta las franjas que ofreces para una fecha. Sin franjas se usa toda tu jornada autorizada.</p>
        </div>
      </div>

      <div className="catalog-card work-schedules-card">
        <div className="catalog-card__heading">
          <div><h3>Fecha</h3><p>Elige el día que quieres ajustar.</p></div>
        </div>
        <div className="work-schedules-filters">
          <label className="field">
            <span>Fecha</span>
            <input type="date" value={fecha} onChange={(event) => changeFecha(event.target.value)} />
          </label>
          {jornadas.length > 1 && (
            <label className="field">
              <span>Jornada</span>
              <select value={selectedId} onChange={(event) => changeJornada(event.target.value)}>
                {jornadas.map((jornada) => (
                  <option key={jornada.horarioBaseId} value={jornada.horarioBaseId}>
                    {jornada.sucursalNombre} · {jornada.horaInicio}–{jornada.horaFin}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {loading && <div className="catalog-card work-schedules-card"><div className="empty-state">Cargando disponibilidad…</div></div>}

      {!loading && error && <div className="form-problem" role="alert">{error}</div>}

      {!loading && selected && (
        <div className="catalog-card work-schedules-card">
          <div className="catalog-card__heading">
            <div>
              <h3>Franjas disponibles</h3>
              <p>Jornada autorizada: {selected.horaInicio}–{selected.horaFin} · {selected.sucursalNombre}</p>
            </div>
          </div>

          {slots.length === 0 ? (
            <div className="empty-state">Sin franjas: se usa toda la jornada autorizada.</div>
          ) : (
            <div className="product-table-wrap">
              <table className="product-table work-schedules-table" aria-label="Franjas disponibles">
                <thead><tr><th>Inicio</th><th>Fin</th><th className="work-schedules-actions-heading">Acciones</th></tr></thead>
                <tbody>
                  {slots.map((slot, index) => (
                    <tr key={`${slot.horaInicio}-${slot.horaFin}-${index}`}>
                      <td><span className="time-cell">{slot.horaInicio}</span></td>
                      <td><span className="time-cell">{slot.horaFin}</span></td>
                      <td className="work-schedules-actions">
                        <button type="button" className="button button--ghost" onClick={() => removeSlot(index)}>
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="availability-slot-form">
            <label className="field">
              <span>Hora de inicio</span>
              <select value={newSlot.horaInicio} onChange={(event) => setNewSlot((current) => ({ ...current, horaInicio: event.target.value }))}>
                <option value="">--:--</option>
                {SLOT_OPTIONS.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Hora de fin</span>
              <select value={newSlot.horaFin} onChange={(event) => setNewSlot((current) => ({ ...current, horaFin: event.target.value }))}>
                <option value="">--:--</option>
                {SLOT_OPTIONS.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
              </select>
            </label>
            <button type="button" className="button button--ghost" onClick={addSlot}>Agregar franja</button>
          </div>

          {slotError && <div className="field-error" role="alert">{slotError}</div>}

          {problem && (
            <div className="form-problem" role="alert">
              <strong>{problem.message}</strong>
              {problem.details.length > 0 && (
                <ul>{problem.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
              )}
            </div>
          )}

          <div className="availability-actions">
            <button type="button" className="button button--danger" onClick={reset} disabled={saving}>
              Restablecer jornada
            </button>
            <button type="button" className="button button--primary" onClick={save} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar disponibilidad'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
