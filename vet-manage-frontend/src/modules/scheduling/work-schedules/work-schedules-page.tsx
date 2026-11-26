import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../auth/auth-context';
import { useToast } from '../../../common/components/toast-context';
import { ApiError } from '../../../infrastructure/api/http-client';
import { schedulingApi } from '../services/scheduling-api';
import type { WorkSchedule, WorkScheduleFormData, VeterinarianOption, Branch, DiaSemana } from '../types';
import './work-schedules.css';

const DIAS_SEMANA: DiaSemana[] = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

const DIA_LABELS: Record<DiaSemana, string> = {
  LUNES: 'Lunes',
  MARTES: 'Martes',
  MIERCOLES: 'Miércoles',
  JUEVES: 'Jueves',
  VIERNES: 'Viernes',
  SABADO: 'Sábado',
};

function generateTimeOptions(): string[] {
  const options: string[] = [];
  for (let h = 6; h <= 22; h++) {
    const hh = String(h).padStart(2, '0');
    options.push(`${hh}:00`);
    if (h < 22) {
      options.push(`${hh}:30`);
    }
  }
  return options;
}

const TIME_OPTIONS = generateTimeOptions();

const EMPTY_FORM: WorkScheduleFormData = {
  veterinarioId: '',
  sucursalId: '',
  diaSemana: 'LUNES',
  horaInicio: '',
  horaFin: '',
};

export function WorkSchedulesPage() {
  const { hasPermission } = useAuth();
  const { showToast, confirm } = useToast();
  const canManage = hasPermission('work-schedules:manage');

  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [veterinarians, setVeterinarians] = useState<VeterinarianOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterSucursalId, setFilterSucursalId] = useState('');
  const [filterVeterinarioId, setFilterVeterinarioId] = useState('');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<WorkScheduleFormData>({ ...EMPTY_FORM });

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const params: { veterinarioId?: string; sucursalId?: string } = {};
      if (filterVeterinarioId) params.veterinarioId = filterVeterinarioId;
      if (filterSucursalId) params.sucursalId = filterSucursalId;
      const data = await schedulingApi.listWorkSchedules(params);
      setSchedules(data);
    } catch (err) {
      if (err instanceof ApiError) {
        showToast(err.message, 'error');
      } else {
        showToast('Ocurrió un error inesperado', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [filterVeterinarioId, filterSucursalId, showToast]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  useEffect(() => {
    Promise.all([
      schedulingApi.listBranches(),
      schedulingApi.listVeterinarians(),
    ]).then(([b, v]) => {
      setBranches(b);
      setVeterinarians(v);
    }).catch((err) => {
      if (err instanceof ApiError) {
        showToast(err.message, 'error');
      } else {
        showToast('Ocurrió un error inesperado', 'error');
      }
    });
  }, [showToast]);

  const openCreateModal = useCallback(() => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback((schedule: WorkSchedule) => {
    setEditingId(schedule.id);
    setForm({
      veterinarioId: schedule.veterinarioId,
      sucursalId: schedule.sucursalId,
      diaSemana: schedule.diaSemana,
      horaInicio: schedule.horaInicio,
      horaFin: schedule.horaFin,
    });
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  }, []);

  const handleSubmit = useCallback(async () => {
    // Validate required fields
    if (!form.veterinarioId || !form.sucursalId || !form.diaSemana || !form.horaInicio || !form.horaFin) {
      showToast('Todos los campos son obligatorios', 'error');
      return;
    }

    // Validate horaFin > horaInicio
    if (form.horaFin <= form.horaInicio) {
      showToast('La hora de fin debe ser posterior a la hora de inicio', 'error');
      return;
    }

    try {
      if (editingId) {
        await schedulingApi.updateWorkSchedule(editingId, form);
        showToast('Horario actualizado exitosamente', 'success');
      } else {
        await schedulingApi.createWorkSchedule(form);
        showToast('Horario creado exitosamente', 'success');
      }
      closeModal();
      await loadSchedules();
    } catch (err) {
      if (err instanceof ApiError) {
        showToast(err.message, 'error');
      } else {
        showToast('Ocurrió un error inesperado', 'error');
      }
    }
  }, [form, editingId, closeModal, loadSchedules, showToast]);

  const handleDelete = useCallback(async (id: string) => {
    if (!await confirm('¿Está seguro de retirar este horario?', 'Sí, retirar horario', 'danger')) return;

    try {
      await schedulingApi.deleteWorkSchedule(id);
      showToast('Horario eliminado exitosamente', 'success');
      await loadSchedules();
    } catch (err) {
      if (err instanceof ApiError) {
        showToast(err.message, 'error');
      } else {
        showToast('Ocurrió un error inesperado', 'error');
      }
    }
  }, [confirm, loadSchedules, showToast]);

  return (
    <section className="inventory-page work-schedules-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Agenda · Horarios</span>
          <h2>Horarios base de atención</h2>
          <p>Configure la disponibilidad semanal por sucursal y veterinario.</p>
        </div>
        {canManage && (
          <button type="button" className="button button--primary" onClick={openCreateModal}>
            Nuevo horario
          </button>
        )}
      </div>

      <div className="catalog-card work-schedules-card">
        <div className="catalog-card__heading work-schedules-toolbar">
          <div>
            <h3>Horarios registrados</h3>
            <p>{loading ? 'Cargando disponibilidad…' : `${schedules.length} horario${schedules.length === 1 ? '' : 's'} encontrado${schedules.length === 1 ? '' : 's'}`}</p>
          </div>
          <div className="work-schedules-filters">
            <label className="field">
              <span>Sucursal</span>
              <select
                value={filterSucursalId}
                onChange={(e) => setFilterSucursalId(e.target.value)}
                aria-label="Filtrar por sucursal"
              >
                <option value="">Todas las sucursales</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.nombre}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Veterinario</span>
              <select
                value={filterVeterinarioId}
                onChange={(e) => setFilterVeterinarioId(e.target.value)}
                aria-label="Filtrar por veterinario"
              >
                <option value="">Todos los veterinarios</option>
                {veterinarians.map((v) => (
                  <option key={v.id} value={v.id}>{v.person.firstName} {v.person.lastName}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">Cargando horarios…</div>
        ) : schedules.length === 0 ? (
          <div className="empty-state work-schedules-empty">
            <div className="work-schedules-empty__icon" aria-hidden="true">◷</div>
            <strong>No hay horarios registrados</strong>
            <p>Prueba otro filtro o crea un nuevo horario base.</p>
            {canManage && <button type="button" className="button button--primary" onClick={openCreateModal}>Nuevo horario</button>}
          </div>
        ) : (
          <div className="product-table-wrap">
            <table className="product-table work-schedules-table" aria-label="Horarios base de atención">
              <thead>
                <tr>
                  <th>Veterinario</th>
                  <th>Día</th>
                  <th>Sucursal</th>
                  <th>Hora inicio</th>
                  <th>Hora fin</th>
                  {canManage && <th className="work-schedules-actions-heading">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.veterinarioNombre}</strong></td>
                    <td><span className="day-pill">{DIA_LABELS[s.diaSemana]}</span></td>
                    <td>{s.sucursalNombre}</td>
                    <td><span className="time-cell">{s.horaInicio}</span></td>
                    <td><span className="time-cell">{s.horaFin}</span></td>
                    {canManage && (
                      <td className="work-schedules-actions">
                        <button type="button" className="button button--secondary button--small" onClick={() => openEditModal(s)}>Editar</button>
                        <button type="button" className="button work-schedules-delete button--small" onClick={() => handleDelete(s.id)}>Eliminar</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-card work-schedules-modal" role="dialog" aria-modal="true" aria-labelledby="work-schedule-modal-title" onClick={(e) => e.stopPropagation()}>
            <div className="modal-card__heading">
              <div>
                <span className="eyebrow">Agenda · Horario</span>
                <h3 id="work-schedule-modal-title">{editingId ? 'Editar horario' : 'Nuevo horario'}</h3>
                <p>Define la disponibilidad semanal del veterinario.</p>
              </div>
              <button type="button" className="modal-card__close" onClick={closeModal} aria-label="Cerrar">×</button>
            </div>

            <div className="modal-card__body">
              <div className="work-schedules-form-grid">
                <label className="field">
                  <span>Veterinario <b>*</b></span>
                  <select
                    value={form.veterinarioId}
                    onChange={(e) => setForm({ ...form, veterinarioId: e.target.value })}
                  >
                    <option value="">Seleccione un veterinario</option>
                    {veterinarians.map((v) => (
                      <option key={v.id} value={v.id}>{v.person.firstName} {v.person.lastName}</option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Sucursal <b>*</b></span>
                  <select
                    value={form.sucursalId}
                    onChange={(e) => setForm({ ...form, sucursalId: e.target.value })}
                  >
                    <option value="">Seleccione una sucursal</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.nombre}</option>
                    ))}
                  </select>
                </label>

                <label className="field work-schedules-form-grid__full">
                  <span>Día de la semana <b>*</b></span>
                  <select
                    value={form.diaSemana}
                    onChange={(e) => setForm({ ...form, diaSemana: e.target.value as DiaSemana })}
                  >
                    {DIAS_SEMANA.map((d) => (
                      <option key={d} value={d}>{DIA_LABELS[d]}</option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Hora inicio <b>*</b></span>
                  <select
                    value={form.horaInicio}
                    onChange={(e) => setForm({ ...form, horaInicio: e.target.value })}
                  >
                    <option value="">Seleccione hora</option>
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Hora fin <b>*</b></span>
                  <select
                    value={form.horaFin}
                    onChange={(e) => setForm({ ...form, horaFin: e.target.value })}
                  >
                    <option value="">Seleccione hora</option>
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="work-schedules-modal__actions">
                <button type="button" className="button button--ghost" onClick={closeModal}>Cancelar</button>
                <button type="button" className="button button--primary" onClick={handleSubmit}>
                  {editingId ? 'Guardar cambios' : 'Crear horario'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
