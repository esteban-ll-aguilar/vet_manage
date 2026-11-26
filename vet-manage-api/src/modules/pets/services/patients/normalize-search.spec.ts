import { normalizeSearch } from './normalize-search.js';
import { patientSearchVariants } from './search-variants.js';

describe('normalizeSearch', () => {
  it('recorta espacios y ignora mayúsculas', () => {
    expect(normalizeSearch('  JOSE  ')).toBe('jose');
  });

  it('elimina tildes', () => {
    expect(normalizeSearch(' josé ')).toBe('jose');
    expect(normalizeSearch('José')).toBe(normalizeSearch('JOSE'));
  });

  it('trata la ñ como n', () => {
    expect(normalizeSearch('Niño')).toBe('nino');
    expect(normalizeSearch('nino')).toBe('nino');
  });
});

describe('patientSearchVariants', () => {
  it('reutiliza las equivalencias de clientes para n y vocales', () => {
    const variants = patientSearchVariants('nino');
    expect(variants).toContain('nino');
    expect(variants).toContain('niño');
    expect(variants.length).toBeLessThanOrEqual(64);
  });

  it('genera variantes acentuadas para un nombre con tilde', () => {
    expect(patientSearchVariants('jose')).toContain('josé');
  });
});
