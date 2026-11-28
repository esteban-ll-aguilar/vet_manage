import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { clientsApi } from '../../../modules/clients/services/clients-api';
import type { ClientListItem, ClientPet } from '../../../modules/clients/types';
import { schedulingApi } from '../services/scheduling-api';
import type { Branch, ClinicService, VeterinarianOption } from '../types';
import { ratesApi, type Rate } from '../rates/rates-api';
import {
  toAppointmentDraft,
  validateAppointmentForm,
  type AppointmentField,
  type AppointmentFieldErrors,
  type AppointmentFormValues,
} from './appointment-form-validation';
import { SLOT_OPTIONS } from './modify/modify-appointment-form';
import type { RegisteredAppointment } from './types';
import { WorkingHoursHint } from './working-hours-hint';
import './appointment-register-page.css';

const EMPTY: AppointmentFormValues = {
  sucursalId: '',
  clienteId: '',
  pacienteId: '',
  servicioId: '',
  veterinarioId: '',
  salaId: '',
  fecha: '',
  horaInicio: '',
  duracionMin: '',
};

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

async function loadActiveClients(): Promise<ClientListItem[]> {
  const clients: ClientListItem[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const result = await clientsApi.list({ status: 'ACTIVE', page, pageSize: 100 });
    clients.push(...result.items);
    totalPages = result.totalPages;
    page += 1;
  }

  return clients;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo registrar la cita.';
}

function formatCurrency(value: number | string): string {
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(Number(value));
}

// Duraciones en períodos de 30 minutos hasta el máximo del servicio.
function durationOptions(maxMinutes: number): number[] {
  return Array.from({ length: Math.floor(maxMinutes / 30) }, (_, index) => (index + 1) * 30);
}

function formatAppointmentTime(value: string): string {
  return new Intl.DateTimeFormat('es-EC', {
    // La agenda guarda la hora local de Ecuador como UTC.
    timeZone: 'UTC',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function AppointmentRegisterPage({
  onBack,
  backLabel = 'Volver a citas',
  initialSelection,
}: {
  onBack: () => void;
  backLabel?: string;
  initialSelection?: Pick<AppointmentFormValues, 'sucursalId' | 'fecha' | 'horaInicio'>;
}) {
  const [values, setValues] = useState<AppointmentFormValues>(() => ({ ...EMPTY, ...initialSelection }));
  const [errors, setErrors] = useState<AppointmentFieldErrors>({});
  const [branches, setBranches] = useState<Branch[]>([]);
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [patients, setPatients] = useState<ClientPet[]>([]);
  const [services, setServices] = useState<ClinicService[]>([]);
  const [veterinarians, setVeterinarians] = useState<VeterinarianOption[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState('');
  const [registered, setRegistered] = useState<RegisteredAppointment | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      schedulingApi.listBranches(),
      loadActiveClients(),
      schedulingApi.listServices(),
      schedulingApi.listVeterinarians(),
    ])
      .then(([loadedBranches, loadedClients, loadedServices, loadedVets]) => {
        if (!active) return;
        setBranches(loadedBranches);
        setClients(loadedClients);
        setServices(loadedServices);
        setVeterinarians(loadedVets);
      })
      .catch((error: unknown) => {
        if (active) setProblem(getErrorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!values.sucursalId) {
      return () => {
        active = false;
      };
    }

    ratesApi.list(undefined, values.sucursalId)
      .then((loadedRates) => {
        if (active) setRates(loadedRates.filter((rate) => rate.estado));
      })
      .catch((error: unknown) => {
        if (active) setProblem(getErrorMessage(error));
      });

    return () => {
      active = false;
    };
  }, [values.sucursalId]);

  const selectedBranch = branches.find((branch) => branch.id === values.sucursalId);
  const rooms = selectedBranch?.salas.filter((room) => room.tipo === 'CONSULTORIO') ?? [];
  const selectedService = services.find((service) => service.id === values.servicioId);
  const selectedRate = rates.find((rate) => rate.servicioId === values.servicioId);
  const activePatients = useMemo(() => patients.filter((patient) => patient.status === 'ACTIVE'), [patients]);

  function update<K extends keyof AppointmentFormValues>(field: K, value: AppointmentFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({
      ...current,
      [field]: undefined,
      ...(field === 'fecha' || field === 'horaInicio'
        ? { fecha: undefined, horaInicio: undefined }
        : {}),
      ...(field === 'servicioId' ? { duracionMin: undefined } : {}),
      ...(field === 'clienteId' ? { pacienteId: undefined } : {}),
    }));
    setProblem('');
    setRegistered(null);
  }

  async function selectClient(clientId: string) {
    update('clienteId', clientId);
    setPatients([]);
    setValues((current) => ({ ...current, clienteId: clientId, pacienteId: '' }));
    if (!clientId) return;

    setLoadingPatients(true);
    try {
      setPatients(await clientsApi.pets(clientId));
    } catch (error) {
      setProblem(getErrorMessage(error));
    } finally {
      setLoadingPatients(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProblem('');
    setRegistered(null);

    const validationErrors = validateAppointmentForm(
      values,
      selectedService?.duracionMaximaMin ?? 0,
    );
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    if (!selectedRate) {
      setProblem('El servicio no tiene una tarifa activa');
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      setRegistered(await schedulingApi.registerAppointment(toAppointmentDraft(values)));
    } catch (error) {
      setProblem(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="inventory-page inventory-form-page">
      <button className="back-link" type="button" onClick={onBack}>← {backLabel}</button>
      <header className="page-heading">
        <div>
          <span className="eyebrow">Agenda · Citas</span>
          <h1>Registrar cita presencial</h1>
          <p>Selecciona cliente, paciente, servicio y recursos para programar la atención.</p>
        </div>
      </header>

      {loading ? (
        <div className="empty-state" role="status">Cargando datos de la agenda...</div>
      ) : (
        <form className="product-form" onSubmit={(event) => void submit(event)} noValidate>
          <div className="form-section">
            <div className="form-section__heading">
              <span className="section-number">01</span>
              <div><h2>Atención</h2><p>Los campos marcados son obligatorios.</p></div>
            </div>
            <div className="form-grid">
              <Field label="Sucursal" field="sucursalId" errors={errors}>
                <select value={values.sucursalId} onChange={(event) => {
                  update('sucursalId', event.target.value);
                  setRates([]);
                  setValues((current) => ({ ...current, sucursalId: event.target.value, salaId: '' }));
                }}>
                  <option value="">Selecciona una sucursal</option>
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.nombre}</option>)}
                </select>
              </Field>
              <Field label="Cliente" field="clienteId" errors={errors}>
                <select value={values.clienteId} onChange={(event) => void selectClient(event.target.value)}>
                  <option value="">Selecciona un cliente</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.firstName} {client.lastName} · {client.identification}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Paciente" field="pacienteId" errors={errors}>
                <select
                  value={values.pacienteId}
                  onChange={(event) => update('pacienteId', event.target.value)}
                  disabled={!values.clienteId || loadingPatients || activePatients.length === 0}
                >
                  <option value="">
                    {loadingPatients
                      ? 'Cargando pacientes...'
                      : !values.clienteId
                        ? 'Selecciona primero un cliente'
                        : activePatients.length === 0
                          ? 'Este cliente no tiene pacientes activos'
                          : 'Selecciona un paciente'}
                  </option>
                  {activePatients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name} · {patient.code}</option>)}
                </select>
              </Field>
              <Field label="Servicio" field="servicioId" errors={errors}>
                <select value={values.servicioId} onChange={(event) => update('servicioId', event.target.value)}>
                  <option value="">Selecciona un servicio</option>
                  {services.map((service) => <option key={service.id} value={service.id}>{service.nombre}</option>)}
                </select>
              </Field>
              <Field label="Veterinario" field="veterinarioId" errors={errors}>
                <select value={values.veterinarioId} onChange={(event) => update('veterinarioId', event.target.value)}>
                  <option value="">Selecciona un veterinario</option>
                  {veterinarians.map((vet) => (
                    <option key={vet.id} value={vet.id}>{vet.person.firstName} {vet.person.lastName}</option>
                  ))}
                </select>
              </Field>
              <Field label="Consultorio" field="salaId" errors={errors}>
                <select
                  value={values.salaId}
                  onChange={(event) => update('salaId', event.target.value)}
                  disabled={!values.sucursalId || rooms.length === 0}
                >
                  <option value="">
                    {!values.sucursalId
                      ? 'Selecciona primero una sucursal'
                      : rooms.length === 0
                        ? 'Esta sucursal no tiene consultorios activos'
                        : 'Selecciona un consultorio'}
                  </option>
                  {rooms.map((room) => <option key={room.id} value={room.id}>{room.nombre}</option>)}
                </select>
              </Field>
              {selectedService && (
                <div className="field">
                  <span>Tarifa vigente</span>
                  <output>{selectedRate ? formatCurrency(selectedRate.importe) : 'Sin tarifa activa'}</output>
                </div>
              )}
            </div>
          </div>

          <div className="form-section">
            <div className="form-section__heading">
              <span className="section-number">02</span>
              <div><h2>Horario</h2><p>La cita debe estar en el futuro y respetar la duración máxima del servicio.</p></div>
            </div>
            <div className="form-grid">
              <Field label="Fecha" field="fecha" errors={errors}>
                <input type="date" min={getToday()} value={values.fecha} onChange={(event) => update('fecha', event.target.value)} />
              </Field>
              <Field label="Hora de inicio" field="horaInicio" errors={errors}>
                <select value={values.horaInicio} onChange={(event) => update('horaInicio', event.target.value)}>
                  <option value="">--:--</option>
                  {SLOT_OPTIONS.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                </select>
              </Field>
              <Field label="Duración (minutos)" field="duracionMin" errors={errors}>
                <select value={values.duracionMin} onChange={(event) => update('duracionMin', event.target.value)} disabled={!selectedService}>
                  <option value="">{selectedService ? 'Seleccione la duración' : 'Seleccione primero el servicio'}</option>
                  {durationOptions(selectedService?.duracionMaximaMin ?? 0).map((minutes) => (
                    <option key={minutes} value={String(minutes)}>{`${minutes} minutos`}</option>
                  ))}
                </select>
              </Field>
              {selectedService && (
                <p className="form-grid__full">
                  Duración mínima: 30 minutos · Máxima para este servicio: {selectedService.duracionMaximaMin} minutos.
                </p>
              )}
              <WorkingHoursHint sucursalId={values.sucursalId} veterinarioId={values.veterinarioId} fecha={values.fecha} />
            </div>
          </div>

          {problem && <div className="form-problem" role="alert">{problem}</div>}
          {registered && (
            <div className="appointment-success" role="status">
              <strong>Cita registrada</strong>
              <span>Número: {registered.numero}</span>
              <span>Estado: Programada</span>
              <span>{formatAppointmentTime(registered.fechaHora)} a {formatAppointmentTime(registered.fechaHoraFin)}</span>
              <span>Tarifa reservada: {formatCurrency(registered.importeReserva)}</span>
            </div>
          )}

          <div className="form-actions">
            <button className="button button--primary" type="submit" disabled={saving || loadingPatients}>
              {saving ? 'Registrando...' : 'Registrar cita'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function Field({
  label,
  field,
  errors,
  children,
}: {
  label: string;
  field: AppointmentField;
  errors: AppointmentFieldErrors;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label} *</span>
      {children}
      {errors[field] && <small className="field-error" role="alert">{errors[field]}</small>}
    </label>
  );
}
