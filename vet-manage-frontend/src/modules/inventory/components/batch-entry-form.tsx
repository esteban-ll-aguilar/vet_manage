import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  BATCH_CODE_MAX,
  mapApiErrorsToFields,
  validateBatchEntryDraft,
  type BatchEntryFieldErrors,
  type BatchEntryFormInput,
} from '../schemas/batch-entry';
import type { BatchEntryDraft, Product } from '../types';

type BatchEntryFormProps = {
  products: Product[];
  productsLoading?: boolean;
  // Debe lanzar el error de la API para mostrarlo junto al campo.
  onSubmit: (draft: BatchEntryDraft) => Promise<void>;
};

const EMPTY: BatchEntryFormInput = { productId: '', code: '', expirationDate: '', initialQuantity: '' };

export function BatchEntryForm({ products, productsLoading = false, onSubmit }: BatchEntryFormProps) {
  const [form, setForm] = useState<BatchEntryFormInput>(EMPTY);
  const [errors, setErrors] = useState<BatchEntryFieldErrors>({});
  const [saving, setSaving] = useState(false);

  function update(field: keyof BatchEntryFormInput, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const validation = validateBatchEntryDraft(form);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      await onSubmit(validation.value);
      setForm(EMPTY);
    } catch (cause) {
      const apiError = cause as { message?: string; errors?: string[] };
      setErrors(mapApiErrorsToFields(apiError.errors?.length ? apiError.errors : [apiError.message ?? '']));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="product-form" onSubmit={submit} noValidate>
      <div className="form-section">
        <div className="form-section__heading">
          <span className="section-number">01</span>
          <div><h3>Producto</h3><p>Selecciona el producto del catálogo al que pertenece el lote.</p></div>
        </div>
        <div className="form-grid">
          <Field className="form-grid__full" label="Producto" required error={errors.productId}>
            <select value={form.productId} onChange={(event) => update('productId', event.target.value)} aria-invalid={Boolean(errors.productId)} disabled={productsLoading}>
              <option value="">{productsLoading ? 'Cargando productos…' : 'Selecciona un producto'}</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>{product.code} · {product.name} (Existencias: {product.stock})</option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section__heading">
          <span className="section-number">02</span>
          <div><h3>Lote</h3><p>Registra el código y la fecha de caducidad impresos en el empaque.</p></div>
        </div>
        <div className="form-grid">
          <Field label="Código del lote" required error={errors.code}>
            <input value={form.code} maxLength={BATCH_CODE_MAX} onChange={(event) => update('code', event.target.value)} placeholder="Ej. L-2026-001" aria-invalid={Boolean(errors.code)} />
          </Field>
          <Field label="Fecha de caducidad" required error={errors.expirationDate}>
            <input type="date" value={form.expirationDate} onChange={(event) => update('expirationDate', event.target.value)} aria-invalid={Boolean(errors.expirationDate)} />
          </Field>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section__heading">
          <span className="section-number">03</span>
          <div><h3>Cantidad</h3><p>Las unidades se sumarán a las existencias del producto al confirmar la entrada.</p></div>
        </div>
        <div className="form-grid">
          <Field label="Cantidad inicial" required error={errors.initialQuantity} hint="Número entero mayor que cero">
            {/* Campo de texto para poder informar cuando se ingresan decimales o letras. */}
            <input inputMode="numeric" value={form.initialQuantity} onChange={(event) => update('initialQuantity', event.target.value)} placeholder="Ej. 50" aria-invalid={Boolean(errors.initialQuantity)} />
          </Field>
        </div>
      </div>

      <div className="form-actions">
        <Link className="button button--ghost" to="/inventory/products">Cancelar</Link>
        <button className="button button--primary" type="submit" disabled={saving}>{saving ? 'Registrando…' : 'Registrar entrada'}</button>
      </div>
    </form>
  );
}

function Field({ label, required, hint, error, className = '', children }: { label: string; required?: boolean; hint?: string; error?: string; className?: string; children: ReactNode }) {
  return (
    <label className={`field ${className}`}>
      <span>{label}{required && <b> *</b>}</span>
      {children}
      {hint && !error && <small>{hint}</small>}
      {error && <small className="field-error" role="alert">{error}</small>}
    </label>
  );
}
