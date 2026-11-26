import type { BatchEntryDraft } from '../types';

// Mismos mensajes que devuelve la API en POST /inventory/batches (HU-02).
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
const MAX_QUANTITY = 2_147_483_647;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const NUMBER_PATTERN = /^[-+]?(\d+\.?\d*|\.\d+)$/;

export type BatchEntryFormInput = {
  productId: string;
  code: string;
  expirationDate: string;
  initialQuantity: string;
};

export type BatchEntryField = keyof BatchEntryFormInput;
export type BatchEntryFieldErrors = Partial<Record<BatchEntryField, string>>;

type BatchEntryValidation =
  | { valid: true; value: BatchEntryDraft; errors: null }
  | { valid: false; value: null; errors: BatchEntryFieldErrors };

function isRealDate(value: string) {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function quantityError(raw: string): string | undefined {
  const value = raw.trim();
  if (!value) return BATCH_ENTRY_MESSAGES.quantityRequired;
  if (!NUMBER_PATTERN.test(value)) return BATCH_ENTRY_MESSAGES.quantityNotInteger;
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity > MAX_QUANTITY) return BATCH_ENTRY_MESSAGES.quantityNotInteger;
  if (quantity <= 0) return BATCH_ENTRY_MESSAGES.quantityNotPositive;
  return undefined;
}

// Valida el formulario de entrada de lote y devuelve el borrador listo para la API.
export function validateBatchEntryDraft(input: BatchEntryFormInput): BatchEntryValidation {
  const errors: BatchEntryFieldErrors = {};
  const code = input.code.trim();
  const expirationDate = input.expirationDate.trim();

  if (!input.productId) errors.productId = BATCH_ENTRY_MESSAGES.productRequired;

  if (!code) errors.code = BATCH_ENTRY_MESSAGES.codeRequired;
  else if (code.length > BATCH_CODE_MAX) errors.code = BATCH_ENTRY_MESSAGES.codeTooLong;

  if (!expirationDate) errors.expirationDate = BATCH_ENTRY_MESSAGES.expirationRequired;
  else if (!isRealDate(expirationDate)) errors.expirationDate = BATCH_ENTRY_MESSAGES.expirationInvalid;

  const quantity = quantityError(input.initialQuantity);
  if (quantity) errors.initialQuantity = quantity;

  if (Object.keys(errors).length > 0) return { valid: false, value: null, errors };

  return {
    valid: true,
    value: { productId: input.productId, code, expirationDate, initialQuantity: Number(input.initialQuantity.trim()) },
    errors: null,
  };
}

// Ubica los mensajes de la API en el campo correspondiente del formulario.
export function mapApiErrorsToFields(messages: string[]): BatchEntryFieldErrors {
  const errors: BatchEntryFieldErrors = {};
  for (const message of messages) {
    if (message.includes('producto')) errors.productId = message;
    else if (message.includes('código del lote')) errors.code = message;
    else if (message.includes('fecha de caducidad')) errors.expirationDate = message;
    else if (message.includes('cantidad inicial')) errors.initialQuantity = message;
  }
  return errors;
}
