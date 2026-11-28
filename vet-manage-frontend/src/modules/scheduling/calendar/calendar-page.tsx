import { useEffect, useRef, useState } from "react";
import { calendarApi } from "./calendar-api";
import {
  dateLabel,
  localDate,
  navigateDate,
  periodDays,
  shiftDate,
  timeLabel,
} from "./calendar-dates";
import type {
  AppointmentDetail,
  AppointmentStatus,
  CalendarAppointment,
  CalendarBranch,
  CalendarData,
  CalendarView,
  ReservationSelection,
} from "./types";
import "./calendar.css";

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  PROGRAMADA: "Programada",
  CONFIRMADA: "Confirmada",
  EN_CURSO: "En curso",
  FINALIZADA: "Finalizada",
  CANCELADA: "Cancelada",
  NO_ASISTIO: "No asistió",
};
const SLOT_TONES = {
  Disponible: "available",
  Bloqueado: "blocked",
  "Fuera de atención": "closed",
  Ocupado: "busy",
  "Sin recursos": "closed",
} as const;

const weekdayLabel = new Intl.DateTimeFormat("es-EC", {
  weekday: "long",
  timeZone: "UTC",
});
const monthLabel = new Intl.DateTimeFormat("es-EC", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function periodLabel(start: string, end: string, view: CalendarView) {
  if (view === "mes") return monthLabel.format(new Date(`${start}T12:00:00Z`));
  if (start === end) return dateLabel(start);
  if (start.slice(0, 7) === end.slice(0, 7)) {
    return `${start.slice(-2)}–${dateLabel(end)}`;
  }
  return `${dateLabel(start)} – ${dateLabel(end)}`;
}

function Badge({ status }: { status: AppointmentStatus }) {
  return (
    <span className={`calendar-status calendar-status--${status}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
function Appointment({
  appointment,
  open,
}: {
  appointment: CalendarAppointment;
  open: () => void;
}) {
  return (
    <button
      className={`calendar-appointment calendar-status--${appointment.estado}`}
      onClick={open}
    >
      <span className="calendar-appointment-meta">
        <strong className="calendar-time">
          {timeLabel(appointment.inicio)}–{timeLabel(appointment.fin)}
        </strong>
        <span>Cita #{appointment.numero}</span>
      </span>
      {localDate(new Date(appointment.inicio)) !==
        localDate(new Date(appointment.fin)) && (
        <small>
          {dateLabel(localDate(new Date(appointment.inicio)))} –{" "}
          {dateLabel(localDate(new Date(appointment.fin)))}
        </small>
      )}
      <span className="calendar-patient">
        <small>Paciente</small>
        {appointment.paciente}
      </span>
      <span className="calendar-vet">
        <small>Veterinario</small>
        {appointment.veterinario}
      </span>
      <Badge status={appointment.estado} />
    </button>
  );
}

export function CalendarPage() {
  const [branches, setBranches] = useState<CalendarBranch[]>([]);
  const [branch, setBranch] = useState("");
  const [date, setDate] = useState(localDate);
  const [view, setView] = useState<CalendarView>("dia");
  const [filter, setFilter] = useState<AppointmentStatus | "">("");
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [revision, setRevision] = useState(0);
  const [detail, setDetail] = useState<AppointmentDetail | null>(null);
  const [detailError, setDetailError] = useState("");
  const [selection, setSelection] = useState<ReservationSelection | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const requestId = useRef(0);
  const detailTrigger = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let active = true;
    calendarApi
      .branches()
      .then((items) => {
        if (active) {
          setBranches(items);
          setBranch(items[0]?.id ?? "");
          if (!items.length) setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(
            e instanceof Error
              ? e.message
              : "No se pudieron cargar las sucursales",
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [retry]);

  useEffect(() => {
    if (!branch || !date) return;
    let active = true;
    calendarApi
      .read(branch, date, view)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : "No se pudo cargar el calendario",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [branch, date, view, revision]);

  function clear() {
    setRevision((v) => v + 1);
    setData(null);
    setError("");
    setLoading(true);
    setSelection(null);
    requestId.current += 1;
    dialog.current?.close();
  }
  async function openDetail(id: string) {
    const current = ++requestId.current;
    detailTrigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setDetail(null);
    setDetailError("");
    dialog.current?.showModal();
    try {
      const result = await calendarApi.detail(id, branch);
      if (current === requestId.current) setDetail(result);
    } catch (e) {
      if (current === requestId.current)
        setDetailError(
          e instanceof Error ? e.message : "No se pudo cargar el detalle",
        );
    }
  }
  const days = data ? periodDays(data.desde, data.hastaExclusiva) : [];
  const visible =
    data?.citas.filter((c) => !filter || c.estado === filter) ?? [];
  const offset = days.length
    ? (new Date(`${days[0]}T12:00:00Z`).getUTCDay() + 6) % 7
    : 0;

  return (
    <main className="calendar-page">
      <header className="calendar-header">
        <div>
          <h1>Calendario de citas</h1>
          <p>Consulta las citas y los horarios de una sucursal.</p>
        </div>
        <span className="calendar-timezone">Hora de Ecuador continental</span>
      </header>
      <div className="calendar-toolbar">
        <div className="calendar-controls">
          <label>
            Sucursal
            <select
              value={branch}
              onChange={(e) => {
                clear();
                setBranch(e.target.value);
              }}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre}
                  {b.estado ? "" : " (inactiva)"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fecha
            <input
              type="date"
              required
              value={date}
              onChange={(e) => {
                if (e.target.value) {
                  clear();
                  setDate(e.target.value);
                }
              }}
            />
          </label>
          <label>
            Vista
            <select
              value={view}
              onChange={(e) => {
                clear();
                setView(e.target.value as CalendarView);
              }}
            >
              <option value="dia">Día</option>
              <option value="semana">Semana</option>
              <option value="mes">Mes</option>
            </select>
          </label>
          <label>
            Estado
            <select
              aria-label="Estado"
              value={filter}
              onChange={(e) =>
                setFilter(e.target.value as AppointmentStatus | "")
              }
            >
              <option value="">Todos los estados</option>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <small className="calendar-filter-help">
              Solo filtra las citas; no cambia las franjas disponibles.
            </small>
          </label>
        </div>
        <nav className="calendar-period" aria-label="Navegación del calendario">
          <h2 aria-live="polite">
            {data
              ? periodLabel(
                  data.desde,
                  shiftDate(data.hastaExclusiva, -1),
                  view,
                )
              : dateLabel(date)}
          </h2>
          <div className="calendar-navigation">
            <button
              onClick={() => {
                clear();
                setDate(navigateDate(date, view, -1));
              }}
            >
              <span aria-hidden="true">‹</span> Anterior
            </button>
            <button
              onClick={() => {
                clear();
                setDate(localDate());
              }}
            >
              Hoy
            </button>
            <button
              onClick={() => {
                clear();
                setDate(navigateDate(date, view, 1));
              }}
            >
              Siguiente <span aria-hidden="true">›</span>
            </button>
          </div>
        </nav>
      </div>
      <div className="calendar-legend" aria-label="Leyenda de estados">
        <strong>Estados de cita</strong>
        {(Object.keys(STATUS_LABELS) as AppointmentStatus[]).map((status) => (
          <Badge key={status} status={status} />
        ))}
      </div>
      {loading && (
        <p className="calendar-message" role="status">
          Cargando calendario…
        </p>
      )}
      {error && (
        <p className="calendar-message calendar-message--error" role="alert">
          {error}{" "}
          <button
            onClick={() => {
              clear();
              if (!branch) setRetry((v) => v + 1);
            }}
          >
            Reintentar
          </button>
        </p>
      )}
      {!loading && !error && !branches.length && (
        <p className="calendar-message">No hay sucursales para consultar.</p>
      )}
      {data && (
        <>
          {!visible.length && view !== "dia" && (
            <p className="calendar-message" role="status">
              No hay citas para los filtros seleccionados.
            </p>
          )}
          {view === "mes" && (
            <p className="calendar-scroll-hint">
              Desliza el calendario para ver todos los días de la semana.
            </p>
          )}
          <div className={`calendar-days calendar-days--${view}`}>
            {view === "mes" &&
              ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
                <div className="calendar-weekday" key={day}>
                  {day}
                </div>
              ))}
            {view === "mes" &&
              Array.from({ length: offset }, (_, i) => (
                <div
                  className="calendar-spacer"
                  key={`empty-${i}`}
                  aria-hidden="true"
                />
              ))}
            {days.map((day) => {
              const start = new Date(`${day}T00:00:00-05:00`).getTime();
              const appointments = visible.filter(
                (c) =>
                  new Date(c.inicio).getTime() < start + 86400000 &&
                  new Date(c.fin).getTime() > start,
              );
              const daySlots = data.franjas.filter(
                (slot) => slot.fecha === day,
              );
              const availableSlots = daySlots.filter(
                (slot) => slot.estado === "Disponible",
              ).length;
              const activeSlots = daySlots.filter(
                (slot) => slot.estado !== "Fuera de atención",
              );
              const closedSlots = daySlots.filter(
                (slot) => slot.estado === "Fuera de atención",
              );
              const slotList = (slots: typeof daySlots) => (
                <ul className="calendar-slots">
                  {slots.map((slot) => (
                    <li key={slot.inicio}>
                      <button
                        className={`calendar-slot calendar-slot--${SLOT_TONES[slot.estado]}`}
                        disabled={slot.estado !== "Disponible"}
                        onClick={() =>
                          setSelection({
                            sucursalId: branch,
                            inicio: slot.inicio,
                            fin: slot.fin,
                          })
                        }
                      >
                        <time className="calendar-time">{slot.hora}</time>{" "}
                        <span className="calendar-slot-label">
                          · {slot.estado}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              );
              return (
                <section
                  className={`calendar-day${!appointments.length ? " calendar-day--empty" : ""}`}
                  key={day}
                  aria-label={dateLabel(day)}
                >
                  <h3 className="calendar-day-heading">
                    <time dateTime={day} aria-label={dateLabel(day)}>
                      <span className="calendar-day-number">
                        {Number(day.slice(-2))}
                      </span>
                      <span>
                        {weekdayLabel.format(new Date(`${day}T12:00:00Z`))}
                      </span>
                    </time>
                    <span className="calendar-count">
                      {appointments.length}{" "}
                      {appointments.length === 1 ? "cita" : "citas"}
                    </span>
                  </h3>
                  <div className="calendar-day-appointments">
                    {view === "dia" && <h4>Citas del día</h4>}
                    {appointments.map((c) => (
                      <Appointment
                        key={c.id}
                        appointment={c}
                        open={() => void openDetail(c.id)}
                      />
                    ))}
                    {!appointments.length && (
                      <div className="calendar-empty-state">
                        <span
                          className="calendar-empty-icon"
                          aria-hidden="true"
                        >
                          ▦
                        </span>
                        <div>
                          <strong>
                            {filter
                              ? "Sin citas para este estado"
                              : "No hay citas para este día"}
                          </strong>
                          <p>
                            {filter
                              ? "Prueba con otro estado para consultar las citas."
                              : "Puedes consultar la disponibilidad de la sucursal a continuación."}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <details
                    className="calendar-availability"
                    open={view === "dia"}
                  >
                    <summary>
                      {daySlots.length
                        ? `Disponibilidad: ${availableSlots} disponible${availableSlots === 1 ? "" : "s"} de ${daySlots.length} franjas`
                        : "Sin franjas configuradas"}
                    </summary>
                    {activeSlots.length > 0 ? (
                      <>
                        <p className="calendar-availability-help">
                          Franjas de 30 minutos. Selecciona un horario
                          disponible.
                        </p>
                        {slotList(activeSlots)}
                      </>
                    ) : daySlots.length > 0 ? (
                      <div className="calendar-closed-state">
                        <span
                          className="calendar-closed-icon"
                          aria-hidden="true"
                        >
                          ◷
                        </span>
                        <div>
                          <strong>Sin horario de atención</strong>
                          <p>
                            No hay franjas de atención habilitadas para esta
                            sucursal en este día. Prueba con otra fecha.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="calendar-empty">
                        No hay horarios configurados para esta fecha.
                      </p>
                    )}
                    {closedSlots.length > 0 && (
                      <details className="calendar-closed-hours">
                        <summary>
                          Ver horarios fuera de atención ({closedSlots.length})
                        </summary>
                        {slotList(closedSlots)}
                      </details>
                    )}
                  </details>
                </section>
              );
            })}
          </div>
        </>
      )}
      {selection && (
        <aside className="calendar-reservation" role="status">
          <strong>
            Franja seleccionada:{" "}
            {dateLabel(localDate(new Date(selection.inicio)))}{" "}
            {timeLabel(selection.inicio)}–{timeLabel(selection.fin)}
          </strong>
          <p>
            Esta selección no crea ni reserva una cita. Continúa al registro
            para completar los datos. La disponibilidad se comprueba nuevamente
            al guardar.
          </p>
          <a
            className="button button--primary"
            href={`/appointments/appointments/new?${new URLSearchParams({
              sucursalId: branch,
              fecha: localDate(new Date(selection.inicio)),
              horaInicio: timeLabel(selection.inicio),
            })}`}
          >
            Registrar cita
          </a>
          <button onClick={() => setSelection(null)}>Cerrar aviso</button>
        </aside>
      )}
      <dialog
        className="calendar-detail"
        ref={dialog}
        aria-labelledby="calendar-detail-title"
        onClose={() => {
          requestId.current += 1;
          detailTrigger.current?.focus();
        }}
      >
        <h2 id="calendar-detail-title">
          Detalle de cita{detail ? ` #${detail.numero}` : ""}
        </h2>
        {!detail && !detailError && <p role="status">Cargando detalle…</p>}
        {detailError && <p role="alert">{detailError}</p>}
        {detail && (
          <>
            <Badge status={detail.estado} />
            <dl>
              {Object.entries({
                Inicio: `${dateLabel(localDate(new Date(detail.inicio)))} ${timeLabel(detail.inicio)}`,
                Fin: `${dateLabel(localDate(new Date(detail.fin)))} ${timeLabel(detail.fin)}`,
                Paciente: detail.paciente,
                Veterinario: detail.veterinario,
                Cliente: detail.cliente,
                Cédula: detail.cedula,
                Consultorio: detail.consultorio,
                Sucursal: detail.sucursal,
              }).map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
        <button
          className="calendar-detail-close"
          autoFocus
          onClick={() => dialog.current?.close()}
        >
          Cerrar detalle
        </button>
      </dialog>
    </main>
  );
}
