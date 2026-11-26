import { getJson, postJson } from '../../../infrastructure/api/http-client';
import type {
  ClientOption,
  PatientQuery,
  PatientSearchResponse,
  RegisteredPatient,
  RegisterPatientDraft,
} from '../types';

type ClientPage = { items: ClientOption[] };

export const patientApi = {
  registerPatient(draft: RegisterPatientDraft) {
    return postJson<RegisteredPatient, RegisterPatientDraft>('/pets', draft);
  },
  searchPatients(query: PatientQuery = {}) {
    const params = new URLSearchParams();
    if (query.search) params.set('search', query.search);
    params.set('page', String(query.page ?? 1));
    params.set('pageSize', String(query.pageSize ?? 20));
    return getJson<PatientSearchResponse>(`/pets?${params.toString()}`);
  },
  // Usa el listado del dominio de clientes (HU-01) filtrando solo los activos.
  async searchActiveClients(search: string) {
    const params = new URLSearchParams({ status: 'ACTIVE', pageSize: '10' });
    if (search.trim()) params.set('search', search.trim());
    const page = await getJson<ClientPage>(`/clients?${params.toString()}`);
    return page.items.map(({ id, identification, firstName, lastName }) => ({ id, identification, firstName, lastName }));
  },
};
