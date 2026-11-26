export type CatalogReferenceInput = {
  id?: string;
  name?: string;
};

export type ProductInput = {
  code?: string;
  name?: string;
  description?: string;
  unitPrice?: number | string;
  category?: CatalogReferenceInput;
  brand?: CatalogReferenceInput;
};

export type ProductInputValidation = {
  valid: boolean;
  errors: Partial<Record<'code' | 'name' | 'description' | 'unitPrice' | 'category' | 'brand', string>>;
};

export function validateProductInput(input: ProductInput): ProductInputValidation {
  const errors: ProductInputValidation['errors'] = {};
  const code = input.code?.trim() ?? '';
  const name = input.name?.trim() ?? '';
  const description = input.description?.trim() ?? '';
  const category = input.category?.id?.trim() || input.category?.name?.trim();
  const brand = input.brand?.id?.trim() || input.brand?.name?.trim();
  const unitPrice = typeof input.unitPrice === 'string'
    ? Number(input.unitPrice)
    : input.unitPrice;

  if (!code) errors.code = 'El código es obligatorio';
  if (!name) errors.name = 'El nombre es obligatorio';
  if (!description) errors.description = 'La descripción es obligatoria';
  if (!category) errors.category = 'La categoría es obligatoria';
  if (!brand) errors.brand = 'La marca es obligatoria';
  if (unitPrice === undefined || unitPrice === null || !Number.isFinite(unitPrice) || unitPrice <= 0) {
    errors.unitPrice = 'El precio unitario debe ser mayor que cero';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
