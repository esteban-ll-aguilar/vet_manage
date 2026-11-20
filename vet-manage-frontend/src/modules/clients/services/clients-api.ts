import { getJson, postJson } from '../../../infrastructure/api/http-client';
import type {
  AssignableRole,
  ClientPage,
  ClientPet,
  ClientQuery,
  RegisteredClient,
  RegisterClientInput,
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
};
