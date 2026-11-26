// Normaliza un término de búsqueda: recorta espacios, baja a minúsculas y
// elimina marcas de acento. La ñ queda como n para que "nino" encuentre "Niño".
export function normalizeSearch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/g, 'n');
}
