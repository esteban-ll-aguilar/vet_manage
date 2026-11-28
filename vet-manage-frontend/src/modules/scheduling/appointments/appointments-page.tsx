import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../../common/components/toast-context';
import { useAuth } from '../../auth/auth-context';
import { appointmentsApi } from './appointments-api';
import { AppointmentsTable } from './appointments-table';
import { STATUS_LABELS } from './appointments-utils';
import { CancelAppointmentDialog } from './cancel-appointment-dialog';
import type { Appointment, AppointmentStatus } from './types';
import './appointments.css';

export function AppointmentsPage() {
  const { hasPermission } = useAuth();
  const { showToast } = useToast();

  const canCancel = hasPermission('appointments:cancel');
  const canModify = hasPermission('appointments:update');
  const canRegister = hasPermission('appointments:create');

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [selected, setSelected] = useState<Appointment | null>(null);

  useEffect(() => {
    let active = true;

    appointmentsApi.list()
      .then((data) => {
        if (active) {
          setAppointments(data);
          setError('');
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'No se pudieron cargar las citas.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  function reload() {
    setLoading(true);
    setReloadKey((key) => key + 1);
  }

  async function cancelAppointment(motivo: string) {
    if (!selected || !canCancel) return;

    await appointmentsApi.cancel(selected.id, motivo);

    setSelected(null);

    showToast(
      'Cita cancelada correctamente',
      'success',
    );

    reload();
  }

  const query = search.trim().toLowerCase();

  const filtered = appointments.filter((appointment) => {
    const matchesSearch =
      String(appointment.numero).includes(query) ||
      appointment.paciente.toLowerCase().includes(query) ||
      appointment.veterinario.toLowerCase().includes(query) ||
      appointment.sucursal.toLowerCase().includes(query);

    const matchesStatus =
      !status || appointment.estado === status;

    return matchesSearch && matchesStatus;
  });

  return (
    <section className="inventory-page appointments-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Agenda · Citas</span>

          <h2>Gestión de citas</h2>

          <p>
            Consulta las citas registradas, modifica su
            horario o recursos y gestiona su cancelación.
          </p>
        </div>

        {canRegister && (
          <Link className="button button--primary" to="/appointments/appointments/new">
            Registrar cita presencial
          </Link>
        )}
      </div>

      <div className="catalog-card">
        <div className="catalog-card__heading">
          <div>
            <h3>Citas registradas</h3>
            <p>Consulta el estado de las citas veterinarias.</p>
          </div>

          <button
            className="button button--ghost"
            type="button"
            onClick={reload}
            disabled={loading}
          >
            Actualizar
          </button>
        </div>

        <div className="appointments-filters">
          <label className="field">
            <span>Buscar cita</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Número, paciente o veterinario"
            />
          </label>

          <label className="field">
            <span>Estado</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Todos los estados</option>

              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option
                  key={value}
                  value={value as AppointmentStatus}
                >
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <div className="empty-state">
            Cargando citas…
          </div>
        ) : error ? (
          <div className="appointment-error" role="alert">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <strong>No hay citas para mostrar</strong>
          </div>
        ) : (
          <AppointmentsTable
            appointments={filtered}
            canCancel={canCancel}
            canModify={canModify}
            onCancel={setSelected}
          />
        )}
      </div>

      {selected && canCancel && (
        <CancelAppointmentDialog
          key={selected.id}
          appointment={selected}
          onClose={() => setSelected(null)}
          onConfirm={cancelAppointment}
        />
      )}
    </section>
  );
}
