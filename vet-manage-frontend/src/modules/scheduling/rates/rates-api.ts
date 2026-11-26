import { getJson, patchJson, postJson } from '../../../infrastructure/api/http-client';

export type Rate = {
  id: string;
  servicioId: string;
  sucursalId: string;
  importe: number | string;
  fechaVigencia: string;
  estado: boolean;
  servicio: { id: string; nombre: string; estado: boolean };
  sucursal: { id: string; nombre: string; estado: boolean };
};

export type RateService = {
  id: string;
  nombre: string;
  duracionMaximaMin: number;
  estado: boolean;
};

export const ratesApi = {
  listServices() {
    return getJson<RateService[]>('/scheduling/rates/services');
  },
  list(servicioId?: string, sucursalId?: string) {
    const query = new URLSearchParams();
    if (servicioId) query.set('servicioId', servicioId);
    if (sucursalId) query.set('sucursalId', sucursalId);
    const suffix = query.toString() ? `?${query}` : '';
    return getJson<Rate[]>(`/scheduling/rates${suffix}`);
  },
  save(body: { servicioId: string; sucursalId: string; importe: number }) {
    return postJson<Rate, typeof body>('/scheduling/rates', body);
  },
  update(id: string, importe: number) {
    return patchJson<Rate, { importe: number }>(`/scheduling/rates/${id}`, { importe });
  },
  deactivateService(id: string) {
    return patchJson<{ id: string; nombre: string; estado: boolean }, Record<string, never>>(
      `/scheduling/rates/services/${id}/deactivate`,
      {},
    );
  },
  activateService(id: string) {
    return patchJson<{ id: string; nombre: string; estado: boolean }, Record<string, never>>(
      `/scheduling/rates/services/${id}/activate`,
      {},
    );
  },
};
