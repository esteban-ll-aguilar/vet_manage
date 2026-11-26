import { ApiError } from '../../../infrastructure/api/http-client';
import type { SupplierInput } from '../types';

export type SupplierDraft = { businessName: string; ruc: string };
export type SupplierFieldErrors = Partial<Record<keyof SupplierInput, string>>;

export const SUPPLIER_RUC_FORMAT_ERROR = 'El RUC debe contener exactamente 13 dígitos numéricos.';

export function validateSupplierDraft(draft: SupplierDraft): SupplierFieldErrors {
  const errors: SupplierFieldErrors = {};
  if (!draft.businessName.trim()) errors.businessName = 'La razón social es obligatoria.';
  if (!draft.ruc.trim()) errors.ruc = 'El RUC es obligatorio.';
  else if (!/^\d{13}$/.test(draft.ruc.trim())) errors.ruc = SUPPLIER_RUC_FORMAT_ERROR;
  return errors;
}

export function buildSupplierInput(draft: SupplierDraft): SupplierInput {
  return { businessName: draft.businessName.trim(), ruc: draft.ruc.trim() };
}

export function supplierApiErrorMessage(cause: unknown, fallback: string): string {
  if (!(cause instanceof ApiError)) {
    return cause instanceof Error ? cause.message : fallback;
  }

  if (cause.status === 403) return 'No tiene permisos para realizar esta acción.';
  if (cause.status === 404) return 'No se encontró el proveedor. Actualice el listado e inténtelo nuevamente.';
  if (cause.status === 400) return cause.message || 'Revise los datos ingresados.';
  if (cause.status === 409) return cause.message || 'El RUC ya está registrado.';
  return cause.message || fallback;
}

export function supplierApiFieldErrors(cause: unknown): SupplierFieldErrors {
  if (cause instanceof ApiError && cause.status === 409) {
    return { ruc: cause.message || 'El RUC ya está registrado.' };
  }
  return {};
}
