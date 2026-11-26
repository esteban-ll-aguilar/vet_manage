import { formatTime, dbTimeToMinutes } from '../../common/time-slots.js';

export interface WorkScheduleResponse {
  id: string;
  veterinarioId: string;
  veterinarioNombre: string;
  sucursalId: string;
  sucursalNombre: string;
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
  estado: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
}

/**
 * Maps a Prisma HorarioBase (with related vet and branch) to the API response shape.
 */
export function toWorkScheduleResponse(record: {
  id: string;
  veterinarioId: string;
  sucursalId: string;
  diaSemana: string;
  horaInicio: Date;
  horaFin: Date;
  estado: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
  veterinario: { person: { firstName: string; lastName: string } };
  sucursal: { nombre: string };
}): WorkScheduleResponse {
  return {
    id: record.id,
    veterinarioId: record.veterinarioId,
    veterinarioNombre: `${record.veterinario.person.firstName} ${record.veterinario.person.lastName}`,
    sucursalId: record.sucursalId,
    sucursalNombre: record.sucursal.nombre,
    diaSemana: record.diaSemana,
    horaInicio: formatTime(dbTimeToMinutes(record.horaInicio)),
    horaFin: formatTime(dbTimeToMinutes(record.horaFin)),
    estado: record.estado,
    creadoEn: record.creadoEn,
    actualizadoEn: record.actualizadoEn,
  };
}
