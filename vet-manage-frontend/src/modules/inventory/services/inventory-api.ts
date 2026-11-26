import { getJson, patchJson, postJson } from '../../../infrastructure/api/http-client';
import type { BatchDetail, BatchEntryDraft, BatchEntryResult, CatalogItem, ExpirationAlert, InventoryCategory, Product, ProductDraft, ProductSearchFilters } from '../types';

export const inventoryApi = {
  listProducts(search = '', filters: ProductSearchFilters = {}) {
    const query = new URLSearchParams();
    const normalizedSearch = search.trim();
    if (normalizedSearch) query.set('search', normalizedSearch);
    if (filters.categoryId) query.set('categoryId', filters.categoryId);
    if (filters.brandId) query.set('brandId', filters.brandId);
    if (filters.batchCode?.trim()) query.set('batchCode', filters.batchCode.trim());
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    return getJson<Product[]>(`/inventory/products${suffix}`);
  },
  listExpirationAlerts() {
    return getJson<ExpirationAlert[]>('/inventory/expiration-alerts');
  },
  updateBatchExpiration(id: string, expirationDate: string) {
    return patchJson<{ lotId: string; expirationDate: string }, { expirationDate: string }>(
      `/inventory/batches/${id}/expiration-date`,
      { expirationDate },
    );
  },
  getProduct(id: string) {
    return getJson<Product>(`/inventory/products/${id}`);
  },
  getBatch(id: string) {
    return getJson<BatchDetail>(`/inventory/batches/${id}`);
  },
  listCategories() {
    return getJson<InventoryCategory[]>('/inventory/categories');
  },
  listBrands() {
    return getJson<CatalogItem[]>('/inventory/brands');
  },
  createProduct(draft: ProductDraft) {
    return postJson<Product, ProductDraft>('/inventory/products', {
      ...draft,
      unitPrice: draft.unitPrice,
    });
  },
  updateProduct(id: string, draft: ProductDraft) {
    return patchJson<Product, ProductDraft>(`/inventory/products/${id}`, draft);
  },
  createCategory(name: string) {
    return postJson<InventoryCategory, { name: string }>('/inventory/categories', { name });
  },
  updateCategory(id: string, input: { name: string; description?: string }) {
    return patchJson<InventoryCategory, { name: string; description?: string }>(`/inventory/categories/${id}`, input);
  },
  updateCategoryVat(id: string, vatRate: string) {
    return patchJson<InventoryCategory, { vatRate: string }>(`/inventory/categories/${id}/vat`, { vatRate });
  },
  createBrand(name: string) {
    return postJson<CatalogItem, { name: string }>('/inventory/brands', { name });
  },
  updateBrand(id: string, input: { name: string; description?: string }) {
    return patchJson<CatalogItem, { name: string; description?: string }>(`/inventory/brands/${id}`, input);
  },
  registerBatchEntry(draft: BatchEntryDraft) {
    return postJson<BatchEntryResult, BatchEntryDraft>('/inventory/batches', draft);
  },
};
