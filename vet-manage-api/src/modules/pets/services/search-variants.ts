import { ACCENT_EQUIVALENTS, MAX_SEARCH_VARIANTS } from '../../clients/repositories/clients.repository.js';
import { normalizeSearch } from './patients/normalize-search.js';

// Variantes con y sin tildes de un término de búsqueda (máximo MAX_SEARCH_VARIANTS).
// Reutiliza la tabla de equivalencias de HU-06 para tener un solo criterio de
// "sin tildes" en clientes, pacientes y razas.
export function searchVariants(search: string): string[] {
  const normalized = normalizeSearch(search);
  let variants = [''];

  for (const char of normalized) {
    const options = ACCENT_EQUIVALENTS[char] ?? [char];
    const next: string[] = [];
    for (const variant of variants) {
      for (const option of options) {
        if (next.length >= MAX_SEARCH_VARIANTS) break;
        next.push(`${variant}${option}`);
      }
      if (next.length >= MAX_SEARCH_VARIANTS) break;
    }
    variants = next;
  }

  return variants;
}
