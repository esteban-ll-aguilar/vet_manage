export const INVALID_CATEGORY_VAT_MESSAGE = 'El IVA debe ser un porcentaje entre 0 y 100 con hasta dos decimales';

const CATEGORY_VAT_PATTERN = /^(?:0*\d{1,2}(?:\.\d{1,2})?|0*100(?:\.0{1,2})?)$/;

export function validateCategoryVat(value: string): string | null {
  return CATEGORY_VAT_PATTERN.test(value) ? null : INVALID_CATEGORY_VAT_MESSAGE;
}

export function formatCategoryVat(value: string | null | undefined): string {
  if (value === null || value === undefined) return 'Sin configurar';

  const [integer, fraction] = value.split('.');
  const normalizedFraction = fraction?.replace(/0+$/, '');
  const normalized = normalizedFraction ? `${integer}.${normalizedFraction}` : integer;
  return `${normalized} %`;
}
