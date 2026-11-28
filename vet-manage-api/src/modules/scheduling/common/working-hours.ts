import type { Prisma } from '../../../generated/prisma/client.js';
import { dbTimeToMinutes } from './time-slots.js';

type Db = Prisma.TransactionClient;

const WEEKDAYS = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'] as const;

export type WorkingHoursQuery = {
  veterinarioId: string;
  sucursalId: string;
  // Fecha a las 00:00 UTC, igual que las fechas de horarios y bloqueos.
  date: Date;
  startMinutes: number;
  endMinutes: number;
};

// Indica si las franjas cubren todo el intervalo, uniendo las que se tocan.
export function coversInterval(
  ranges: { inicio: number; fin: number }[],
  start: number,
  end: number,
): boolean {
  let coveredUntil = start;
  for (const range of [...ranges].sort((a, b) => a.inicio - b.inicio)) {
    if (range.inicio > coveredUntil) return false;
    coveredUntil = Math.max(coveredUntil, range.fin);
    if (coveredUntil >= end) return true;
  }
  return coveredUntil >= end;
}

// El veterinario atiende todo el intervalo en esa sucursal si tiene una jornada vigente que lo cubre,
// es el turno asignado del sábado y, si registró disponibilidad diaria, esta también lo cubre.
// Son las mismas reglas que usa la consulta de recursos disponibles.
export async function isWithinWorkingHours(db: Db, query: WorkingHoursQuery): Promise<boolean> {
  const diaSemana = WEEKDAYS[query.date.getUTCDay()];
  if (diaSemana === 'DOMINGO') return false;

  const schedules = await db.horarioBase.findMany({
    where: {
      veterinarioId: query.veterinarioId,
      sucursalId: query.sucursalId,
      diaSemana,
      estado: true,
    },
    select: { id: true, horaInicio: true, horaFin: true },
  });

  let candidates = schedules.filter(
    (schedule) =>
      dbTimeToMinutes(schedule.horaInicio) <= query.startMinutes &&
      dbTimeToMinutes(schedule.horaFin) >= query.endMinutes,
  );

  if (diaSemana === 'SABADO') {
    const shift = await db.turnoSabado.findUnique({
      where: { sucursalId_fecha: { sucursalId: query.sucursalId, fecha: query.date } },
      select: { horarioBaseId: true },
    });
    candidates = candidates.filter((schedule) => schedule.id === shift?.horarioBaseId);
  }

  for (const schedule of candidates) {
    const ranges = await db.disponibilidadDiaria.findMany({
      where: { horarioBaseId: schedule.id, fecha: query.date },
      select: { horaInicio: true, horaFin: true },
    });
    if (ranges.length === 0) return true;

    const intervals = ranges.map((range) => ({
      inicio: dbTimeToMinutes(range.horaInicio),
      fin: dbTimeToMinutes(range.horaFin),
    }));
    if (coversInterval(intervals, query.startMinutes, query.endMinutes)) return true;
  }

  return false;
}
