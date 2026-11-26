const BIRTH_DATE_PATTERN = /^(\d{2})-(\d{2})-(\d{4})$/;

// Zona horaria de la clínica: «hoy» no depende de la zona del servidor (el contenedor corre en UTC).
export const CLINIC_TIME_ZONE = 'America/Guayaquil';

// Día calendario de `now` en la zona de la clínica, como medianoche UTC.
export function clinicToday(now: Date = new Date(), timeZone: string = CLINIC_TIME_ZONE): number {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(now);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(part('year'), part('month') - 1, part('day'));
}

// Convierte una fecha DD-MM-YYYY en Date (UTC). Devuelve null si no existe o es posterior a hoy en la clínica.
export function parseBirthDate(value: unknown, now: Date = new Date()): Date | null {
  if (typeof value !== 'string') return null;
  const match = BIRTH_DATE_PATTERN.exec(value.trim());
  if (!match) return null;

  const [, dd, mm, yyyy] = match;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  const date = new Date(Date.UTC(year, month - 1, day));

  // Date.UTC desborda fechas como 31-02 al mes siguiente: si no coincide, no existe.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;

  if (date.getTime() > clinicToday(now)) return null;

  return date;
}

// Formatea una fecha guardada (columna DATE, en UTC) como DD-MM-YYYY.
export function formatBirthDate(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${date.getUTCFullYear()}`;
}
