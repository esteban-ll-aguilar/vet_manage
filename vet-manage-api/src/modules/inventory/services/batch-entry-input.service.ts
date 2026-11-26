// Reglas de validación de la entrada de lote (HU-02). Se valida aquí, y no con
// decoradores del DTO, para devolver un mensaje claro y único por cada campo.

export type BatchEntryInput = {
  productId?: unknown;
  code?: unknown;
  expirationDate?: unknown;
  initialQuantity?: unknown;
};

export type BatchEntryField = 'productId' | 'code' | 'expirationDate' | 'initialQuantity';

export type ValidBatchEntry = {
  productId: string;
  code: string;
  expirationDate: Date;
  initialQuantity: number;
};

export type BatchEntryValidation =
  | { valid: true; value: ValidBatchEntry; errors: Record<string, never> }
  | { valid: false; value: null; errors: Partial<Record<BatchEntryField, string>> };

export const BATCH_ENTRY_MESSAGES = {
  productRequired: 'Debe seleccionar un producto',
  codeRequired: 'Debe ingresar el código del lote',
  codeTooLong: 'El código del lote no puede exceder los 50 caracteres',
  expirationRequired: 'Debe ingresar la fecha de caducidad',
  expirationInvalid: 'La fecha de caducidad no es válida',
  quantityRequired: 'Debe ingresar la cantidad inicial',
  quantityNotPositive: 'La cantidad inicial debe ser mayor que cero',
  quantityNotInteger: 'La cantidad inicial debe ser un número entero mayor que cero',
} as const;

export const BATCH_CODE_MAX = 50;
// Límite de una columna INTEGER de PostgreSQL.
const MAX_QUANTITY = 2_147_483_647;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const NUMBER_PATTERN = /^[-+]?(\d+\.?\d*|\.\d+)$/;

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

function parseDate(value: string): Date | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  // Rechaza fechas inexistentes como 2027-02-30.
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

function validateQuantity(value: unknown): { quantity?: number; error?: string } {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    return { error: BATCH_ENTRY_MESSAGES.quantityRequired };
  }
  const raw = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  if (!NUMBER_PATTERN.test(raw)) return { error: BATCH_ENTRY_MESSAGES.quantityNotInteger };

  const quantity = Number(raw);
  if (!Number.isInteger(quantity) || quantity > MAX_QUANTITY) return { error: BATCH_ENTRY_MESSAGES.quantityNotInteger };
  if (quantity <= 0) return { error: BATCH_ENTRY_MESSAGES.quantityNotPositive };
  return { quantity };
}

export function validateBatchEntryInput(input: BatchEntryInput): BatchEntryValidation {
  const errors: Partial<Record<BatchEntryField, string>> = {};
  const productId = text(input.productId);
  const code = text(input.code);
  const expirationText = text(input.expirationDate);

  if (!productId || !UUID_PATTERN.test(productId)) errors.productId = BATCH_ENTRY_MESSAGES.productRequired;

  if (!code) errors.code = BATCH_ENTRY_MESSAGES.codeRequired;
  else if (code.length > BATCH_CODE_MAX) errors.code = BATCH_ENTRY_MESSAGES.codeTooLong;

  const expirationDate = expirationText ? parseDate(expirationText) : null;
  if (!expirationText) errors.expirationDate = BATCH_ENTRY_MESSAGES.expirationRequired;
  else if (!expirationDate) errors.expirationDate = BATCH_ENTRY_MESSAGES.expirationInvalid;

  const { quantity, error: quantityError } = validateQuantity(input.initialQuantity);
  if (quantityError) errors.initialQuantity = quantityError;

  if (Object.keys(errors).length > 0 || !expirationDate || quantity === undefined) {
    return { valid: false, value: null, errors };
  }

  return { valid: true, value: { productId, code, expirationDate, initialQuantity: quantity }, errors: {} };
}
