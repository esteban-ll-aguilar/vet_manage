import { useEffect, useState } from 'react';
import { inventoryApi } from '../services/inventory-api';
import type { CatalogItem } from '../types';
import { useToast } from '../../../common/components/toast-context';
import { useAuth } from '../../auth/auth-context';

export function CatalogPage({ type }: { type: 'category' | 'brand' }) {
  const label = type === 'category' ? 'Categorías' : 'Marcas';
  const singular = type === 'category' ? 'categoría' : 'marca';
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
  const { showToast } = useToast();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(type === 'category' ? 'inventory:manage-categories' : 'inventory:manage-brands');
  useEffect(() => { void (type === 'category' ? inventoryApi.listCategories() : inventoryApi.listBrands()).then(setItems).catch((cause) => showToast(cause instanceof Error ? cause.message : `No se pudieron cargar las ${label.toLowerCase()}.`, 'error')); }, [label, showToast, type]);
  async function create() { if (name.trim().length < 2) { showToast(`Escribe un nombre de ${singular} válido.`, 'info'); return; } try { const item = type === 'category' ? await inventoryApi.createCategory(name) : await inventoryApi.createBrand(name); setItems((current) => [...current, item].sort((a, b) => a.name.localeCompare(b.name))); setName(''); showToast(`${type === 'category' ? 'Categoría' : 'Marca'} creada correctamente`, 'success'); } catch (cause) { showToast(cause instanceof Error ? cause.message : `No se pudo crear la ${singular}.`, 'error'); } }
  function startEditing(item: CatalogItem) { setEditing(item); setEditingName(item.name); setEditingDescription(item.description ?? ''); }
  async function saveEdit() { if (!editing || editingName.trim().length < 2) { showToast(`Escribe un nombre de ${singular} válido.`, 'info'); return; } try { const updated = type === 'category' ? await inventoryApi.updateCategory(editing.id, { name: editingName, description: editingDescription }) : await inventoryApi.updateBrand(editing.id, { name: editingName, description: editingDescription }); setItems((current) => current.map((item) => item.id === updated.id ? updated : item).sort((a, b) => a.name.localeCompare(b.name))); setEditing(null); showToast(`${type === 'category' ? 'Categoría' : 'Marca'} actualizada correctamente`, 'success'); } catch (cause) { showToast(cause instanceof Error ? cause.message : `No se pudo actualizar la ${singular}.`, 'error'); } }
  return <section className="inventory-page"><div className="page-heading"><div><span className="eyebrow">Inventario</span><h2>{label}</h2><p>Administra las opciones disponibles para clasificar tus productos.</p></div></div><div className="catalog-card catalog-manager">{canManage && <div className="manager-form"><label className="field"><span>Nueva {singular}</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Escribe un nombre" /></label><button className="button button--primary" type="button" onClick={() => void create()}>Agregar</button></div>}<div className="simple-list">{items.map((item) => <div className="simple-list__item" key={item.id}>{editing?.id === item.id ? <div className="catalog-edit-form"><input value={editingName} onChange={(event) => setEditingName(event.target.value)} aria-label={`Nombre de ${singular}`} /><input value={editingDescription} onChange={(event) => setEditingDescription(event.target.value)} placeholder="Descripción opcional" aria-label="Descripción" /><div className="inline-actions"><button className="button button--primary button--small" type="button" onClick={() => void saveEdit()}>Guardar</button><button className="button button--ghost button--small" type="button" onClick={() => setEditing(null)}>Cancelar</button></div></div> : <><span className="list-icon">{type === 'category' ? '◈' : '✦'}</span><div className="list-copy"><strong>{item.name}</strong>{item.description && <small>{item.description}</small>}</div>{canManage && <button className="button button--ghost button--small" type="button" onClick={() => startEditing(item)}>Editar</button>}</>}</div>)}</div></div></section>;
}
