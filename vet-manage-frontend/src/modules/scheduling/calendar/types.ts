export type CalendarView = "dia" | "semana" | "mes";
export type AppointmentStatus =
  | "PROGRAMADA"
  | "CONFIRMADA"
  | "EN_CURSO"
  | "FINALIZADA"
  | "CANCELADA"
  | "NO_ASISTIO";
export type CalendarAppointment = {
  id: string;
  numero: number;
  /** Instante ISO real; formatear en America/Guayaquil. */
  inicio: string;
  fin: string;
  paciente: string;
  veterinario: string;
  estado: AppointmentStatus;
};
export type AppointmentDetail = CalendarAppointment & {
  cliente: string;
  cedula: string;
  consultorio: string;
  sucursal: string;
};
export type CalendarSlot = {
  fecha: string;
  hora: string;
  /** Instante ISO real; formatear en America/Guayaquil. */
  inicio: string;
  fin: string;
  estado:
    | "Disponible"
    | "Bloqueado"
    | "Fuera de atención"
    | "Ocupado"
    | "Sin recursos";
};
export type CalendarBranch = { id: string; nombre: string; estado: boolean };
export type CalendarData = {
  sucursal: CalendarBranch;
  desde: string;
  hastaExclusiva: string;
  zonaHoraria: string;
  citas: CalendarAppointment[];
  franjas: CalendarSlot[];
};
/** Punto de integración con el registro de citas; no implica reserva ni persistencia. */
export type ReservationSelection = {
  sucursalId: string;
  /** Instante ISO real; formatear en America/Guayaquil. */
  inicio: string;
  fin: string;
};
