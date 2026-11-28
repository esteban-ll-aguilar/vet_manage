import type { AppointmentStatus } from '../types';

export type AppointmentDetail = {
  id: string;
  numero: number;
  estado: AppointmentStatus;
  modificable: boolean;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  duracionMin: number;
  sucursal: { id: string; nombre: string };
  servicio: string | null;
  paciente: string;
  cliente: { nombre: string; cedula: string };
  veterinarioId: string;
  veterinario: string;
  salaId: string;
  sala: string;
  importeReserva: string;
  tienePagoAprobado: boolean;
  cambioHorarioUtilizado: boolean;
};

export type AppointmentChangeDraft = {
  fecha: string;
  horaInicio: string;
  veterinarioId: string;
  salaId: string;
};

export type ModifiedAppointment = AppointmentChangeDraft & {
  id: string;
  numero: number;
  estado: AppointmentStatus;
  horaFin: string;
  cambioHorarioUtilizado: boolean;
};
