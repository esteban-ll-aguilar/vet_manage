import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getJson, patchJson, postJson } from '../../../infrastructure/api/http-client';
import { ratesApi } from './rates-api';

vi.mock('../../../infrastructure/api/http-client', () => ({
  getJson: vi.fn(),
  patchJson: vi.fn(),
  postJson: vi.fn(),
}));

describe('ratesApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('carga todas las tarifas sin filtros de estado ni parámetros por defecto', async () => {
    vi.mocked(getJson).mockResolvedValue([]);

    await ratesApi.list();

    expect(getJson).toHaveBeenCalledWith('/scheduling/rates');
  });

  it('envía la creación de tarifa a la API persistente', async () => {
    const body = { servicioId: 'service-1', sucursalId: 'branch-1', importe: 20 };
    vi.mocked(postJson).mockResolvedValue({} as never);

    await ratesApi.save(body);

    expect(postJson).toHaveBeenCalledWith('/scheduling/rates', body);
  });

  it('invoca el endpoint de activación del servicio', async () => {
    vi.mocked(patchJson).mockResolvedValue({} as never);

    await ratesApi.activateService('service-1');

    expect(patchJson).toHaveBeenCalledWith('/scheduling/rates/services/service-1/activate', {});
  });
});
