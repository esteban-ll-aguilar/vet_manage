// Utilidades de horas compartidas por las secciones de la agenda.
// Las horas se manejan en minutos desde la medianoche; las columnas @db.Time de Prisma
// se leen y escriben como fechas del 1970-01-01 en UTC.

export const SLOT_MINUTES = 30;

// Convierte "HH:mm" a minutos. Devuelve null si el formato o la hora no son válidos.
export function parseTime(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

// Horas en punto o y media.
export function isOnSlot(minutes: number): boolean {
  return minutes % SLOT_MINUTES === 0;
}

export function minutesToDbTime(minutes: number): Date {
  return new Date(Date.UTC(1970, 0, 1, Math.floor(minutes / 60), minutes % 60));
}

export function dbTimeToMinutes(time: Date): number {
  return time.getUTCHours() * 60 + time.getUTCMinutes();
}

// Dos intervalos [inicio, fin) se cruzan si uno empieza antes de que termine el otro.
// Intervalos contiguos (uno termina a las 12:00 y el otro empieza a las 12:00) no se cruzan.
export function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA;
}
