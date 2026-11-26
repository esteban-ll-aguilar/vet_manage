import { getJson, patchJson, postJson } from '../../../infrastructure/api/http-client';
import type {
  ActivatedClient,
  AssignableRole,
  ClientPage,
  ClientPet,
  ClientQuery,
  DeactivatedClient,
  InactivatedClient,
  RegisteredClient,
  RegisterClientInput,
  UpdateClientInput,
  UpdatedClient,
} from '../types';

export const clientsApi = {
  list(query: ClientQuery = {}) {
    const params = new URLSearchParams();
    if (query.search?.trim()) params.set('search', query.search.trim());
    if (query.status) params.set('status', query.status);
    if (query.page) params.set('page', String(query.page));
    if (query.pageSize) params.set('pageSize', String(query.pageSize));
    const suffix = params.toString();
    return getJson<ClientPage>(`/clients${suffix ? `?${suffix}` : ''}`);
  },
  pets(clientId: string) {
    return getJson<ClientPet[]>(`/clients/${clientId}/pets`);
  },
  assignableRoles() {
    return getJson<AssignableRole[]>('/clients/assignable-roles');
  },
  register(input: RegisterClientInput) {
    return postJson<RegisteredClient, RegisterClientInput>('/clients', input);
  },
  update(clientId: string, input: UpdateClientInput) {
    return patchJson<UpdatedClient, UpdateClientInput>(`/clients/${clientId}`, input);
  },
  inactivate(clientId: string) {
    return patchJson<InactivatedClient, Record<string, never>>(`/clients/${clientId}/inactivate`, {});
  },
  activate(clientId: string) {
    return patchJson<ActivatedClient, Record<string, never>>(`/clients/${clientId}/activate`, {});
  },
  // Baja definitiva con motivo obligatorio (HU-03).
  deactivate(clientId: string, reason: string) {
    return patchJson<DeactivatedClient, { reason: string }>(`/clients/${clientId}/deactivate`, { reason });
  },
};
