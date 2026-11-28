const ECUADOR_OFFSET_MS = 5 * 60 * 60 * 1000;

// Momento actual expresado con la misma convención que las citas guardadas.
export function localNow(now = new Date()): Date {
  return new Date(now.getTime() - ECUADOR_OFFSET_MS);
}

// Fecha (YYYY-MM-DD) y hora (HH:mm) locales al valor que se guarda en la base.
export function toStoredDateTime(fecha: string, hora: string): Date {
  return new Date(`${fecha}T${hora}:00.000Z`);
}

// Valor guardado en la base a fecha y hora locales.
export function fromStoredDateTime(value: Date): {
  fecha: string;
  hora: string;
} {
  const iso = value.toISOString();
  return { fecha: iso.slice(0, 10), hora: iso.slice(11, 16) };
}

// Convierte la hora de pared almacenada a un instante real para contratos ISO externos.
// No aplicar a auditorías u otros timestamps que ya representan instantes UTC reales.
export function storedDateTimeToInstant(value: Date): Date {
  return new Date(value.getTime() + ECUADOR_OFFSET_MS);
}
