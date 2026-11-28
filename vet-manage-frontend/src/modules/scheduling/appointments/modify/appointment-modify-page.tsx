import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../../../../common/components/toast-context';
import { schedulingApi } from '../../services/scheduling-api';
import type { Branch, VeterinarianOption } from '../../types';
import { STATUS_LABELS } from '../appointments-utils';
import { WorkingHoursHint } from '../working-hours-hint';
import { modifyAppointmentApi } from './modify-appointment-api';
import {
  MODIFY_MESSAGES,
  SLOT_OPTIONS,
  endTime,
  formFromDetail,
  hasChanges,
  scheduleChanged,
  validateModifyForm,
  type ModifyFieldErrors,
} from './modify-appointment-form';
import type { AppointmentChangeDraft, AppointmentDetail } from './types';
import '../appointments.css';
import './appointment-modify.css';

export const APPOINTMENTS_PATH = '/appointments/appointments';

const errorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

const formatCurrency = (value: string) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(Number(value));

function formatDate(value: string): string {
  const [year, month, day] = value.split('-');
  return day && month && year ? `${day}/${month}/${year}` : value;
}

function getToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function AppointmentModifyPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [detail, setDetail] = useState<AppointmentDetail | null>(null);
  const [form, setForm] = useState<AppointmentChangeDraft | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [veterinarians, setVeterinarians] = useState<VeterinarianOption[]>([]);
  const [loadError, setLoadError] = useState('');
  const [errors, setErrors] = useState<ModifyFieldErrors>({});
  const [problem, setProblem] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      modifyAppointmentApi.detail(id),
      schedulingApi.listBranches(),
      schedulingApi.listVeterinarians(),
    ])
      .then(([loadedDetail, loadedBranches, loadedVets]) => {
        if (!active) return;
        setDetail(loadedDetail);
        setForm(formFromDetail(loadedDetail));
        setBranches(loadedBranches);
        setVeterinarians(loadedVets);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(errorMessage(error, 'No se pudo cargar la cita.'));
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (loadError) {
    return (
      <PageFrame>
        <div className="appointment-error" role="alert">{loadError}</div>
      </PageFrame>
    );
  }

  if (!detail || !form) {
    return (
      <PageFrame>
        <div className="empty-state">Cargando cita…</div>
      </PageFrame>
    );
  }

  const rooms =
    branches.find((branch) => branch.id === detail.sucursal.id)?.salas.filter((room) => room.tipo === 'CONSULTORIO') ?? [];
  const changingSchedule = scheduleChanged(detail, form);

  function update<K extends keyof AppointmentChangeDraft>(field: K, value: AppointmentChangeDraft[K]) {
    setForm((current) => (current ? { ...current, [field]: value } : current));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setProblem('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || !form || saving) return;

    const validation = validateModifyForm(form);
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }
    if (!hasChanges(detail, form)) {
      setProblem(MODIFY_MESSAGES.noChanges);
      return;
    }

    setSaving(true);
    setProblem('');
    try {
      await modifyAppointmentApi.modify(detail.id, form);
      showToast('Cita modificada correctamente', 'success');
      navigate(APPOINTMENTS_PATH);
    } catch (error) {
      setProblem(errorMessage(error, 'No se pudo modificar la cita.'));
    } finally {
      setSaving(false);
    }
  }

  const disabled = !detail.modificable || saving;

  return (
    <PageFrame numero={detail.numero}>
      <section className="catalog-card appointment-summary" aria-label="Datos de la cita">
        <dl>
          <SummaryItem label="Paciente" value={detail.paciente} />
          <SummaryItem label="Cliente" value={`${detail.cliente.nombre} · ${detail.cliente.cedula}`} />
          <SummaryItem label="Sucursal" value={detail.sucursal.nombre} />
          <SummaryItem label="Servicio" value={detail.servicio ?? '—'} />
          <SummaryItem label="Horario actual" value={`${formatDate(detail.fecha)} · ${detail.horaInicio}–${detail.horaFin}`} />
          <SummaryItem label="Duración" value={`${detail.duracionMin} minutos`} />
          <SummaryItem label="Reserva" value={`${formatCurrency(detail.importeReserva)}${detail.tienePagoAprobado ? ' · pago aprobado' : ''}`} />
          <SummaryItem
            label="Estado"
            value={
              <span className={`appointment-status appointment-status--${detail.estado.toLowerCase()}`}>
                {STATUS_LABELS[detail.estado]}
              </span>
            }
          />
        </dl>
        <p className="appointment-summary__note">
          Se conservan el cliente, el paciente, la sucursal, el servicio, la duración, la tarifa y los pagos.
        </p>
      </section>

      {!detail.modificable ? (
        <div className="form-notice form-notice--error" role="alert">{MODIFY_MESSAGES.invalidStatus}</div>
      ) : detail.cambioHorarioUtilizado ? (
        <div className="form-notice form-notice--warning" role="status">
          {MODIFY_MESSAGES.scheduleChangeUsed}. Solo puede cambiar el veterinario o el consultorio.
        </div>
      ) : null}

      <form className="product-form" onSubmit={(event) => void submit(event)} noValidate>
        <div className="form-section">
          <div className="form-section__heading">
            <span className="section-number">01</span>
            <div>
              <h3>Nuevo horario</h3>
              <p>La cita conserva su duración de {detail.duracionMin} minutos.</p>
            </div>
          </div>
          <div className="form-grid">
            <Field label="Fecha" error={errors.fecha}>
              <input
                type="date"
                value={form.fecha}
                min={getToday()}
                disabled={disabled}
                onChange={(event) => update('fecha', event.target.value)}
                aria-invalid={Boolean(errors.fecha)}
              />
            </Field>
            <Field label="Hora de inicio" error={errors.horaInicio}>
              <select
                value={form.horaInicio}
                disabled={disabled}
                onChange={(event) => update('horaInicio', event.target.value)}
                aria-invalid={Boolean(errors.horaInicio)}
              >
                <option value="">--:--</option>
                {SLOT_OPTIONS.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
              </select>
            </Field>
            <p className="form-grid__full appointment-modify__end">
              Termina a las <strong>{form.horaInicio ? endTime(form.horaInicio, detail.duracionMin) : '--:--'}</strong>
            </p>
            <WorkingHoursHint sucursalId={detail.sucursal.id} veterinarioId={form.veterinarioId} fecha={form.fecha} />
            {changingSchedule && detail.modificable && !detail.cambioHorarioUtilizado && (
              <p className="form-grid__full form-notice form-notice--info" role="status">
                {MODIFY_MESSAGES.scheduleChangeWarning}
              </p>
            )}
          </div>
        </div>

        <div className="form-section">
          <div className="form-section__heading">
            <span className="section-number">02</span>
            <div>
              <h3>Recursos</h3>
              <p>Consultorios de {detail.sucursal.nombre}.</p>
            </div>
          </div>
          <div className="form-grid">
            <Field label="Veterinario" error={errors.veterinarioId}>
              <select
                value={form.veterinarioId}
                disabled={disabled}
                onChange={(event) => update('veterinarioId', event.target.value)}
                aria-invalid={Boolean(errors.veterinarioId)}
              >
                <option value="">Seleccione un veterinario</option>
                {veterinarians.map((vet) => (
                  <option key={vet.id} value={vet.id}>{`${vet.person.firstName} ${vet.person.lastName}`}</option>
                ))}
              </select>
            </Field>
            <Field label="Consultorio" error={errors.salaId}>
              <select
                value={form.salaId}
                disabled={disabled}
                onChange={(event) => update('salaId', event.target.value)}
                aria-invalid={Boolean(errors.salaId)}
              >
                <option value="">Seleccione un consultorio</option>
                {rooms.map((room) => <option key={room.id} value={room.id}>{room.nombre}</option>)}
              </select>
            </Field>
          </div>
        </div>

        {problem && <div className="form-problem" role="alert">{problem}</div>}

        <div className="form-actions">
          <Link className="button button--ghost" to={APPOINTMENTS_PATH}>Cancelar</Link>
          <button className="button button--primary" type="submit" disabled={disabled}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </PageFrame>
  );
}

function PageFrame({ numero, children }: { numero?: number; children: ReactNode }) {
  return (
    <section className="inventory-page inventory-form-page appointment-modify-page">
      <Link className="back-link" to={APPOINTMENTS_PATH}>← Volver a citas</Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Agenda · Citas</span>
          <h2>{numero ? `Modificar cita N.° ${numero}` : 'Modificar cita'}</h2>
          <p>Cambia la fecha, la hora, el veterinario o el consultorio. Se verifica la disponibilidad antes de liberar el horario anterior.</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label} <b>*</b></span>
      {children}
      {error && <small className="field-error" role="alert">{error}</small>}
    </label>
  );
}
