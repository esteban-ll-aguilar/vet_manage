import { getJson, patchJson, postJson } from '../../../infrastructure/api/http-client';
import type { Supplier, SupplierInput, SupplierListQuery, SupplierListResponse } from '../types';

export const suppliersApi = {
  list(query: SupplierListQuery) {
    const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
    if (query.search) params.set('search', query.search);
    if (query.status) params.set('status', query.status);
    return getJson<SupplierListResponse>(`/suppliers?${params.toString()}`);
  },

  get(id: string) {
    return getJson<Supplier>(`/suppliers/${encodeURIComponent(id)}`);
  },

  create(input: SupplierInput) {
    return postJson<Supplier, SupplierInput>('/suppliers', input);
  },

  update(id: string, input: SupplierInput) {
    return patchJson<Supplier, SupplierInput>(`/suppliers/${encodeURIComponent(id)}`, input);
  },
};
