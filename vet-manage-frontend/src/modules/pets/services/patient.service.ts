import { getJson, postJson } from '../../../infrastructure/api/http-client';
import type { ClientOption, RegisteredPatient, RegisterPatientDraft } from '../types';

type ClientPage = { items: ClientOption[] };

export const patientApi = {
  registerPatient(draft: RegisterPatientDraft) {
    return postJson<RegisteredPatient, RegisterPatientDraft>('/pets', draft);
  },
  // Usa el listado del dominio de clientes (HU-01) filtrando solo los activos.
  async searchActiveClients(search: string) {
    const params = new URLSearchParams({ status: 'ACTIVE', pageSize: '10' });
    if (search.trim()) params.set('search', search.trim());
    const page = await getJson<ClientPage>(`/clients?${params.toString()}`);
    return page.items.map(({ id, identification, firstName, lastName }) => ({ id, identification, firstName, lastName }));
  },
};
