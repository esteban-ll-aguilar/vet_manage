import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { inventoryApi } from '../services/inventory-api';
import type { CatalogItem } from '../types';
import { formatCategoryVat, validateCategoryVat } from '../schemas/category-vat';
import { useToast } from '../../../common/components/toast-context';
import { useAuth } from '../../auth/auth-context';
import './catalog-page.css';

type CatalogPageItem = CatalogItem & { vatRate?: string | null };

export function CatalogPage({ type }: { type: 'category' | 'brand' }) {
  const label = type === 'category' ? 'Categorías' : 'Marcas';
  const singular = type === 'category' ? 'categoría' : 'marca';
  const [items, setItems] = useState<CatalogPageItem[]>([]);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
  const [editingVatCategoryId, setEditingVatCategoryId] = useState<string | null>(null);
  const [vatDraft, setVatDraft] = useState('');
  const [vatError, setVatError] = useState<string | null>(null);
  const [savingVat, setSavingVat] = useState(false);
  const { showToast } = useToast();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(type === 'category' ? 'inventory:manage-categories' : 'inventory:manage-brands');
  // El backend admite todas las categorías activas; cualquier limitación funcional requiere acuerdo, no inferencia por nombre.
  const canConfigureVat = type === 'category' && hasPermission('inventory:configure-vat');

  useEffect(() => {
    let cancelled = false;
    const request = type === 'category' ? inventoryApi.listCategories() : inventoryApi.listBrands();

    void request
      .then((loadedItems) => {
        if (!cancelled) setItems(loadedItems);
      })
      .catch((cause) => {
        if (!cancelled) {
          showToast(cause instanceof Error ? cause.message : `No se pudieron cargar las ${label.toLowerCase()}.`, 'error');
        }
      });

    return () => { cancelled = true; };
  }, [label, showToast, type]);

  async function create() {
    if (name.trim().length < 2) {
      showToast(`Escribe un nombre de ${singular} válido.`, 'info');
      return;
    }

    try {
      const item = type === 'category' ? await inventoryApi.createCategory(name) : await inventoryApi.createBrand(name);
      setItems((current) => [...current, item].sort((a, b) => a.name.localeCompare(b.name)));
      setName('');
      showToast(`${type === 'category' ? 'Categoría' : 'Marca'} creada correctamente`, 'success');
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : `No se pudo crear la ${singular}.`, 'error');
    }
  }

  function startEditing(item: CatalogItem) {
    setEditing(item);
    setEditingName(item.name);
    setEditingDescription(item.description ?? '');
  }

  async function saveEdit() {
    if (!editing || editingName.trim().length < 2) {
      showToast(`Escribe un nombre de ${singular} válido.`, 'info');
      return;
    }

    try {
      const updated = type === 'category'
        ? await inventoryApi.updateCategory(editing.id, { name: editingName, description: editingDescription })
        : await inventoryApi.updateBrand(editing.id, { name: editingName, description: editingDescription });
      setItems((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item)
        .sort((a, b) => a.name.localeCompare(b.name)));
      setEditing(null);
      showToast(`${type === 'category' ? 'Categoría' : 'Marca'} actualizada correctamente`, 'success');
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : `No se pudo actualizar la ${singular}.`, 'error');
    }
  }

  function startEditingVat(item: CatalogPageItem) {
    if (!canConfigureVat) return;
    setEditingVatCategoryId(item.id);
    setVatDraft(item.vatRate ?? '');
    setVatError(null);
  }

  function cancelEditingVat() {
    setEditingVatCategoryId(null);
    setVatDraft('');
    setVatError(null);
  }

  async function saveVatRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canConfigureVat || !editingVatCategoryId) return;

    const validationError = validateCategoryVat(vatDraft);
    if (validationError) {
      setVatError(validationError);
      return;
    }

    setSavingVat(true);
    setVatError(null);
    try {
      const updated = await inventoryApi.updateCategoryVat(editingVatCategoryId, vatDraft);
      setItems((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
      setEditingVatCategoryId(null);
      setVatDraft('');
      showToast('IVA actualizado correctamente', 'success');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'No se pudo actualizar el IVA.';
      setVatError(message);
      showToast(message, 'error');
    } finally {
      setSavingVat(false);
    }
  }

  return (
    <section className="inventory-page catalog-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Inventario</span>
          <h2>{label}</h2>
          <p>Administra las opciones disponibles para clasificar tus productos.</p>
        </div>
      </div>

      <div className="catalog-card catalog-manager">
        {canManage && (
          <div className="manager-form">
            <label className="field">
              <span>Nueva {singular}</span>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Escribe un nombre" />
            </label>
            <button className="button button--primary" type="button" onClick={() => void create()}>
              Agregar
            </button>
          </div>
        )}

        <div className="simple-list" role="list" aria-label={label}>
          {items.map((item) => {
            const isEditing = editing?.id === item.id;
            const isEditingVat = type === 'category' && editingVatCategoryId === item.id;
            const vatErrorId = `category-vat-error-${item.id}`;
            const vatHintId = `category-vat-hint-${item.id}`;

            return (
              <div className="catalog-list__item" role="listitem" key={item.id}>
                <span className="list-icon" aria-hidden="true">{type === 'category' ? '◈' : '✦'}</span>

                {isEditing ? (
                  <div className="catalog-edit-form">
                    <input
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      aria-label={`Nombre de ${singular}`}
                    />
                    <input
                      value={editingDescription}
                      onChange={(event) => setEditingDescription(event.target.value)}
                      placeholder="Descripción opcional"
                      aria-label="Descripción"
                    />
                    <div className="inline-actions">
                      <button className="button button--primary button--small" type="button" onClick={() => void saveEdit()}>
                        Guardar
                      </button>
                      <button className="button button--ghost button--small" type="button" onClick={() => setEditing(null)}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="list-copy">
                    <strong>{item.name}</strong>
                    {item.description && <small>{item.description}</small>}
                  </div>
                )}

                {type === 'category' && !isEditingVat && (
                  <div className="category-vat">
                    <span className="category-vat__label">IVA</span>
                    <strong>{formatCategoryVat(item.vatRate)}</strong>
                  </div>
                )}

                <div className="catalog-list__actions">
                  {canManage && !isEditing && (
                    <button
                      className="button button--ghost button--small"
                      type="button"
                      onClick={() => startEditing(item)}
                      aria-label={`Editar ${singular} ${item.name}`}
                    >
                      Editar
                    </button>
                  )}
                  {canConfigureVat && !isEditingVat && (
                    <button
                      className="button button--secondary button--small"
                      type="button"
                      onClick={() => startEditingVat(item)}
                      aria-label={`Editar IVA de ${item.name}`}
                      disabled={savingVat}
                    >
                      Editar IVA
                    </button>
                  )}
                </div>

                {isEditingVat && (
                  <div className="category-vat-editor">
                    <p className="category-vat-editor__current">
                      IVA vigente: <strong>{formatCategoryVat(item.vatRate)}</strong>
                    </p>
                    <form className="category-vat-editor__form" onSubmit={(event) => void saveVatRate(event)}>
                      <label className="field">
                        <span>Nuevo IVA (%)</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          value={vatDraft}
                          onChange={(event) => {
                            setVatDraft(event.target.value);
                            if (vatError) setVatError(null);
                          }}
                          aria-label={`Nuevo IVA de ${item.name}`}
                          aria-invalid={Boolean(vatError)}
                          aria-describedby={vatError ? vatErrorId : vatHintId}
                          disabled={savingVat}
                        />
                        <small id={vatHintId}>De 0 a 100, máximo dos decimales. Usa punto como separador.</small>
                        {vatError && <small id={vatErrorId} className="field-error" role="alert">{vatError}</small>}
                      </label>
                      <div className="inline-actions category-vat-editor__actions">
                        <button
                          className="button button--primary button--small"
                          type="submit"
                          aria-label={`Guardar IVA de ${item.name}`}
                          disabled={savingVat}
                        >
                          {savingVat ? 'Guardando…' : 'Guardar IVA'}
                        </button>
                        <button
                          className="button button--ghost button--small"
                          type="button"
                          onClick={cancelEditingVat}
                          aria-label={`Cancelar edición de IVA de ${item.name}`}
                          disabled={savingVat}
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
