import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CatalogInlineCreate } from '../components/catalog-inline-create';
import { inventoryApi } from '../services/inventory-api';
import type { CatalogItem, ProductDraft } from '../types';
import { useToast } from '../../../common/components/toast-context';

type FieldErrors = Partial<Record<'code' | 'name' | 'description' | 'unitPrice' | 'category' | 'brand', string>>;

export function ProductFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const [categories, setCategories] = useState<CatalogItem[]>([]);
  const [brands, setBrands] = useState<CatalogItem[]>([]);
  const [draft, setDraft] = useState<ProductDraft>({ code: '', name: '', description: '', unitPrice: '', category: {}, brand: {} });
  const [errors, setErrors] = useState<FieldErrors>({});
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [inlineCreate, setInlineCreate] = useState<'category' | 'brand' | null>(null);

  useEffect(() => {
    Promise.all([inventoryApi.listCategories(), inventoryApi.listBrands()]).then(async ([loadedCategories, loadedBrands]) => {
      setCategories(loadedCategories); setBrands(loadedBrands);
      if (id) {
        const loadedProduct = await inventoryApi.getProduct(id);
        setDraft({ code: loadedProduct.code, name: loadedProduct.name, description: loadedProduct.description ?? '', unitPrice: loadedProduct.unitPrice, category: { id: loadedProduct.category.id }, brand: { id: loadedProduct.brand.id } });
      }
    }).catch(() => showToast('No se pudieron cargar las categorías y marcas.', 'error'));
  }, [id, showToast]);

  function update(field: keyof ProductDraft, value: string) {
    if (field === 'category' || field === 'brand') return;
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function selectReference(field: 'category' | 'brand', id: string) {
    setDraft((current) => ({ ...current, [field]: id ? { id } : {} }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function createReference(type: 'category' | 'brand', name: string) {
    const item = type === 'category' ? await inventoryApi.createCategory(name) : await inventoryApi.createBrand(name);
    if (type === 'category') { setCategories((current) => [...current, item].sort((a, b) => a.name.localeCompare(b.name))); }
    else { setBrands((current) => [...current, item].sort((a, b) => a.name.localeCompare(b.name))); }
    setDraft((current) => ({ ...current, [type]: { id: item.id } }));
    setInlineCreate(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const validationErrors: FieldErrors = {};
    if (!draft.code.trim()) validationErrors.code = 'El código es obligatorio';
    if (!draft.name.trim()) validationErrors.name = 'El nombre es obligatorio';
    if (!draft.description.trim()) validationErrors.description = 'La descripción es obligatoria';
    if (!draft.category.id) validationErrors.category = 'La categoría es obligatoria';
    if (!draft.brand.id) validationErrors.brand = 'La marca es obligatoria';
    if (!draft.unitPrice || Number(draft.unitPrice) <= 0) validationErrors.unitPrice = 'El precio unitario debe ser mayor que cero';
    if (Object.keys(validationErrors).length > 0) { setErrors(validationErrors); showToast('Completa los campos obligatorios para continuar.', 'info'); return; }
    setErrors({}); setSaving(true);
    try {
      if (isEditing && id) await inventoryApi.updateProduct(id, draft);
      else await inventoryApi.createProduct(draft);
      showToast(isEditing ? 'Producto actualizado correctamente' : 'Producto registrado correctamente', 'success');
      window.setTimeout(() => navigate('/inventory/products'), 700);
    } catch (cause) {
      const apiError = cause as { message?: string; errors?: string[] };
      const message = apiError.message ?? (isEditing ? 'No se pudo actualizar el producto.' : 'No se pudo registrar el producto.');
      const backendErrors = apiError.errors ?? [message];
      setErrors({
        code: backendErrors.find((item) => item.includes('código')),
        name: backendErrors.find((item) => item.includes('nombre')),
        description: backendErrors.find((item) => item.includes('descripción')),
        category: backendErrors.find((item) => item.includes('categoría')),
        brand: backendErrors.find((item) => item.includes('marca')),
        unitPrice: backendErrors.find((item) => item.includes('precio')) ?? (message.includes('código') ? undefined : message.includes('precio') ? message : undefined),
      });
      showToast(message, 'error');
    } finally { setSaving(false); }
  }

  return (
    <section className="inventory-page inventory-form-page">
      <Link className="back-link" to="/inventory/products">← Volver a productos</Link>
      <div className="page-heading"><div><span className="eyebrow">Inventario · Productos</span><h2>{isEditing ? 'Editar producto' : 'Registrar producto'}</h2><p>{isEditing ? 'Actualiza la información del producto sin perder sus relaciones.' : 'Completa la información esencial para incorporarlo al catálogo.'}</p></div></div>
      <form className="product-form" onSubmit={submit} noValidate>
        <div className="form-section"><div className="form-section__heading"><span className="section-number">01</span><div><h3>Identificación</h3><p>Usa un código único para encontrar el producto rápidamente.</p></div></div><div className="form-grid"><Field label="Código del producto" required error={errors.code}><input value={draft.code} onChange={(event) => update('code', event.target.value)} placeholder="Ej. PR-001" aria-invalid={Boolean(errors.code)} /></Field><Field label="Nombre del producto" required error={errors.name}><input value={draft.name} onChange={(event) => update('name', event.target.value)} placeholder="Ej. Alimento para perro" aria-invalid={Boolean(errors.name)} /></Field><Field className="form-grid__full" label="Descripción" required error={errors.description}><textarea value={draft.description} onChange={(event) => update('description', event.target.value)} placeholder="Describe brevemente el producto" rows={3} aria-invalid={Boolean(errors.description)} /></Field></div></div>
        <div className="form-section"><div className="form-section__heading"><span className="section-number">02</span><div><h3>Clasificación</h3><p>Relaciona el producto con una categoría y una marca.</p></div></div><div className="form-grid"><CatalogField label="Categoría" value={draft.category.id ?? ''} options={categories} error={errors.category} onChange={(value) => selectReference('category', value)} onCreate={() => setInlineCreate('category')} />{inlineCreate === 'category' && <CatalogInlineCreate label="Categoría" onCreate={(name) => createReference('category', name)} onCancel={() => setInlineCreate(null)} />}<CatalogField label="Marca" value={draft.brand.id ?? ''} options={brands} error={errors.brand} onChange={(value) => selectReference('brand', value)} onCreate={() => setInlineCreate('brand')} />{inlineCreate === 'brand' && <CatalogInlineCreate label="Marca" onCreate={(name) => createReference('brand', name)} onCancel={() => setInlineCreate(null)} />}</div></div>
        <div className="form-section"><div className="form-section__heading"><span className="section-number">03</span><div><h3>Precio</h3><p>Define el precio unitario de referencia del producto.</p></div></div><div className="form-grid"><Field label="Precio unitario" required error={errors.unitPrice} hint="Debe ser mayor que cero"><div className="currency-input"><span>$</span><input type="number" min="0.01" step="0.01" value={draft.unitPrice} onChange={(event) => update('unitPrice', event.target.value)} placeholder="0.00" aria-invalid={Boolean(errors.unitPrice)} /></div></Field></div></div>
        <div className="form-actions"><Link className="button button--ghost" to="/inventory/products">Cancelar</Link><button className="button button--primary" type="submit" disabled={saving}>{saving ? (isEditing ? 'Guardando…' : 'Registrando…') : (isEditing ? 'Guardar cambios' : 'Registrar producto')}</button></div>
      </form>
    </section>
  );
}

function Field({ label, required, hint, error, className = '', children }: { label: string; required?: boolean; hint?: string; error?: string; className?: string; children: React.ReactNode }) { return <label className={`field ${className}`}><span>{label}{required && <b> *</b>}</span>{children}{hint && !error && <small>{hint}</small>}{error && <small className="field-error">{error}</small>}</label>; }
function CatalogField({ label, value, options, error, onChange, onCreate }: { label: string; value: string; options: CatalogItem[]; error?: string; onChange: (value: string) => void; onCreate: () => void }) { return <div className="catalog-field"><label className="field"><span>{label}<b> *</b></span><select value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)}><option value="">Selecciona una opción</option>{options.map((option) => <option value={option.id} key={option.id}>{option.name}</option>)}</select>{error && <small className="field-error">{error}</small>}</label><button type="button" className="create-link" onClick={onCreate}>＋ Crear nueva {label.toLowerCase()}</button></div>; }
