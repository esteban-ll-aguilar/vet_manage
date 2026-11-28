export type AppointmentDraft = {
  sucursalId: string;
  clienteId: string;
  pacienteId: string;
  servicioId: string;
  veterinarioId: string;
  salaId: string;
  fecha: string;
  horaInicio: string;
  duracionMin: number;
};

export type RegisteredAppointment = {
  id: string;
  numero: number;
  fechaHora: string;
  fechaHoraFin: string;
  estado: 'PROGRAMADA' | string;
  importeReserva: number | string;
};

export type AppointmentStatus =
  | 'PROGRAMADA'
  | 'CONFIRMADA'
  | 'EN_CURSO'
  | 'FINALIZADA'
  | 'CANCELADA'
  | 'NO_ASISTIO';

export type Appointment = {
  id: string;
  numero: number;
  estado: AppointmentStatus;
  fechaHora: string;
  fechaHoraFin: string;
  paciente: string;
  sucursal: string;
  sala: string;
  veterinario: string;
  tienePagoAprobado: boolean;
};

export type CancelAppointmentDraft = {
  motivo: string;
};

export type CancelledAppointment = {
  id: string;
  estado: 'CANCELADA';
  motivo: string;
  canceladaPorId: string;
  fechaCancelacion: string;
};
