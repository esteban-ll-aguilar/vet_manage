import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../../../common/components/toast-context';
import { useAuth } from '../../auth/auth-context';
import {
  supplierApiErrorMessage,
  supplierApiFieldErrors,
  validateSupplierDraft,
} from '../schemas/supplier';
import type { SupplierDraft, SupplierFieldErrors } from '../schemas/supplier';
import { suppliersApi } from '../services/suppliers-api';
import './suppliers-page.css';

const EMPTY_DRAFT: SupplierDraft = { businessName: '', ruc: '' };

export function SupplierFormPage() {
  const { id } = useParams<{ id: string }>();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission } = useAuth();
  const [draft, setDraft] = useState<SupplierDraft>(EMPTY_DRAFT);
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [fieldErrors, setFieldErrors] = useState<SupplierFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const [loadedSupplierId, setLoadedSupplierId] = useState<string | null>(null);
  const loading = Boolean(id && loadedSupplierId !== id);
  const backPath = hasPermission('suppliers:read') ? '/inventory/suppliers' : '/';

  useEffect(() => {
    if (!id) return;

    let current = true;
    suppliersApi.get(id).then((supplier) => {
      if (!current) return;
      setDraft({ businessName: supplier.businessName, ruc: supplier.ruc });
      setIsActive(supplier.isActive);
      setFormError(null);
      setLoadedSupplierId(id);
    }).catch((cause: unknown) => {
      if (current) {
        setFormError(supplierApiErrorMessage(cause, 'No se pudo cargar el proveedor.'));
        setLoadedSupplierId(id);
      }
    });

    return () => { current = false; };
  }, [id, reload]);

  function updateField(field: keyof SupplierDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  }

  function updateRuc(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 13);
    setDraft((current) => ({ ...current, ruc: digits }));
    setFieldErrors((current) => ({
      ...current,
      ruc: /\D/.test(value) ? 'El RUC solo admite dígitos numéricos.' : undefined,
    }));
    setFormError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const errors = validateSupplierDraft(draft);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setFormError('Complete los campos obligatorios para continuar.');
      return;
    }

    setFormError(null);
    setSaving(true);
    const input = { businessName: draft.businessName.trim(), ruc: draft.ruc.trim() };
    try {
      if (id) {
        await suppliersApi.update(id, input);
        showToast('Proveedor actualizado correctamente', 'success');
      } else {
        await suppliersApi.create(input);
        showToast('Proveedor registrado correctamente', 'success');
      }
      navigate(hasPermission('suppliers:read') ? '/inventory/suppliers' : '/');
    } catch (cause) {
      const message = supplierApiErrorMessage(
        cause,
        editing ? 'No se pudo actualizar el proveedor.' : 'No se pudo registrar el proveedor.',
      );
      setFieldErrors(supplierApiFieldErrors(cause));
      setFormError(message);
      showToast(message, 'error');
      setSaving(false);
    }
  }

  if (loading) {
    return <section className="inventory-page suppliers-page"><div className="empty-state" role="status">Cargando proveedor…</div></section>;
  }

  if (editing && formError && isActive === null) {
    return (
      <section className="inventory-page suppliers-page">
        <Link className="back-link" to={backPath}>← Volver a proveedores</Link>
        <div className="supplier-message supplier-message--error" role="alert">
          <p>{formError}</p>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => {
              setLoadedSupplierId(null);
              setReload((value) => value + 1);
            }}
          >
            Reintentar
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="inventory-page suppliers-page">
      <Link className="back-link" to={backPath}>← Volver a proveedores</Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Inventario · Proveedores</span>
          <h2>{editing ? 'Editar proveedor' : 'Registrar proveedor'}</h2>
          <p>{editing ? 'Actualice la razón social o el RUC del proveedor.' : 'Ingrese los datos obligatorios del proveedor.'}</p>
        </div>
      </div>

      <form className="product-form supplier-form" onSubmit={(event) => void submit(event)} noValidate>
        <section className="form-section" aria-labelledby="supplier-form-heading">
          <div className="form-section__heading">
            <span className="section-number" aria-hidden="true">01</span>
            <div>
              <h3 id="supplier-form-heading">Datos del proveedor</h3>
              <p>Los campos marcados con * son obligatorios.</p>
            </div>
          </div>

          {editing && isActive !== null && (
            <div className="supplier-current-status">
              <span>Estado actual</span>
              <span className={`status-badge ${isActive ? 'status-badge--active' : 'status-badge--inactive'}`}>
                {isActive ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          )}

          {formError && <p className="supplier-message supplier-message--error" role="alert">{formError}</p>}

          <div className="form-grid supplier-fields">
            <label className="field form-grid__full" htmlFor="supplier-business-name">
              <span>Razón social <b aria-hidden="true">*</b></span>
              <input
                id="supplier-business-name"
                name="businessName"
                type="text"
                autoComplete="organization"
                required
                value={draft.businessName}
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.businessName)}
                aria-describedby={fieldErrors.businessName ? 'supplier-business-name-error' : undefined}
                disabled={saving}
                onChange={(event) => updateField('businessName', event.target.value)}
              />
              {fieldErrors.businessName && <small id="supplier-business-name-error" className="field-error">{fieldErrors.businessName}</small>}
            </label>

            <label className="field form-grid__full" htmlFor="supplier-ruc">
              <span>RUC <b aria-hidden="true">*</b></span>
              <input
                id="supplier-ruc"
                name="ruc"
                type="text"
                autoComplete="off"
                spellCheck={false}
                inputMode="numeric"
                maxLength={13}
                pattern="[0-9]{13}"
                required
                value={draft.ruc}
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.ruc)}
                aria-describedby={fieldErrors.ruc ? 'supplier-ruc-hint supplier-ruc-error' : 'supplier-ruc-hint'}
                disabled={saving}
                onChange={(event) => updateRuc(event.target.value)}
              />
              <small id="supplier-ruc-hint">Ingrese exactamente 13 dígitos numéricos. Los ceros iniciales se conservan.</small>
              {fieldErrors.ruc && (
                <small id="supplier-ruc-error" className="field-error" role="status" aria-live="polite">
                  {fieldErrors.ruc}
                </small>
              )}
            </label>
          </div>
        </section>

        <div className="form-actions supplier-form__actions">
          <Link className="button button--ghost" to={backPath}>Cancelar</Link>
          <button className="button button--primary" type="submit" disabled={saving}>
            {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Registrar proveedor'}
          </button>
        </div>
      </form>
    </section>
  );
}
