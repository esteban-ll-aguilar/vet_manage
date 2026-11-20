import { getJson, patchJson, postJson } from '../../../infrastructure/api/http-client';
import type { BatchEntryDraft, BatchEntryResult, CatalogItem, ExpirationAlert, Product, ProductDraft } from '../types';

export const inventoryApi = {
  listProducts(search = '') {
    const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
    return getJson<Product[]>(`/inventory/products${query}`);
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
  listCategories() {
    return getJson<CatalogItem[]>('/inventory/categories');
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
    return postJson<CatalogItem, { name: string }>('/inventory/categories', { name });
  },
  updateCategory(id: string, input: { name: string; description?: string }) {
    return patchJson<CatalogItem, { name: string; description?: string }>(`/inventory/categories/${id}`, input);
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
