import { Link } from 'react-router-dom';
import type { Appointment } from './types';
import { STATUS_LABELS, formatAppointmentDate } from './appointments-utils';

type AppointmentsTableProps = {
  appointments: Appointment[];
  canCancel: boolean;
  canModify?: boolean;
  onCancel: (appointment: Appointment) => void;
};

const MODIFIABLE = new Set(['PROGRAMADA', 'CONFIRMADA']);

// Las Confirmadas también muestran Cancelar: si tienen pago, la API pide la autorización del Administrador o Gerente.
const CANCELLABLE = new Set(['PROGRAMADA', 'CONFIRMADA']);

export function AppointmentsTable({
  appointments,
  canCancel,
  canModify = false,
  onCancel,
}: AppointmentsTableProps) {
  const showActions = canCancel || canModify;

  return (
    <div className="product-table-wrap">
      <table className="product-table">
        <thead>
          <tr>
            <th className="appointment-cell--nowrap">N.º cita</th>
            <th>Paciente</th>
            <th className="appointment-cell--nowrap">Fecha y hora</th>
            <th>Sucursal y consultorio</th>
            <th>Veterinario</th>
            <th>Pago</th>
            <th>Estado</th>
            {showActions && <th>Acciones</th>}
          </tr>
        </thead>

        <tbody>
          {appointments.map((appointment) => (
            <tr key={appointment.id}>
              <td className="appointment-cell--nowrap">#{appointment.numero}</td>
              <td>{appointment.paciente}</td>
              <td className="appointment-cell--nowrap">
                {formatAppointmentDate(appointment.fechaHora)}
              </td>
              <td>
                <span className="appointment-place">
                  {appointment.sucursal}
                  <small>{appointment.sala}</small>
                </span>
              </td>
              <td>{appointment.veterinario}</td>
              <td>
                {appointment.tienePagoAprobado ? 'Sí' : 'No'}
              </td>
              <td>
                <span
                  className={`appointment-status appointment-status--${appointment.estado.toLowerCase()}`}
                >
                  {STATUS_LABELS[appointment.estado]}
                </span>
              </td>

              {showActions && (
                <td>
                  <div className="appointment-actions">
                    {canModify && MODIFIABLE.has(appointment.estado) && (
                      <Link
                        className="button button--secondary appointment-action"
                        to={`/appointments/appointments/${appointment.id}/edit`}
                        aria-label={`Modificar cita ${appointment.numero}`}
                      >
                        Modificar
                      </Link>
                    )}
                    {canCancel && CANCELLABLE.has(appointment.estado) && (
                      <button
                        className="button button--danger-soft appointment-action"
                        type="button"
                        aria-label={`Cancelar cita ${appointment.numero}`}
                        onClick={() => onCancel(appointment)}
                      >
                        Cancelar
                      </button>
                    )}
                    {!(canModify && MODIFIABLE.has(appointment.estado)) &&
                      !(canCancel && CANCELLABLE.has(appointment.estado)) && <span className="appointment-actions__empty">—</span>}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
