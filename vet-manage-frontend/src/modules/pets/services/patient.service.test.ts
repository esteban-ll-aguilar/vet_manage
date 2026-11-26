import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getJson } from '../../../infrastructure/api/http-client';
import { patientApi } from './patient.service';

vi.mock('../../../infrastructure/api/http-client', () => ({
  getJson: vi.fn(),
  postJson: vi.fn(),
}));

describe('patientApi.searchActiveClients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('conserva status, search y pageSize al consultar el listado de clientes', async () => {
    vi.mocked(getJson).mockResolvedValue({
      items: [{
        id: 'c1',
        identification: '0961447281',
        firstName: 'María',
        lastName: 'López',
        status: 'ACTIVE',
      }],
      total: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    });

    const clients = await patientApi.searchActiveClients('  mar  ');

    expect(getJson).toHaveBeenCalledWith('/clients?status=ACTIVE&pageSize=10&search=mar');
    expect(clients).toEqual([{
      id: 'c1',
      identification: '0961447281',
      firstName: 'María',
      lastName: 'López',
    }]);
  });

  it('omite search cuando el término está vacío', async () => {
    vi.mocked(getJson).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 });

    await expect(patientApi.searchActiveClients('   ')).resolves.toEqual([]);
    expect(getJson).toHaveBeenCalledWith('/clients?status=ACTIVE&pageSize=10');
  });
});

describe('patientApi.searchPatients', () => {
  const page = { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('construye la query con search, page y pageSize', async () => {
    vi.mocked(getJson).mockResolvedValue(page);

    await patientApi.searchPatients({ search: 'josé', page: 2, pageSize: 10 });

    expect(getJson).toHaveBeenCalledWith('/pets?search=jos%C3%A9&page=2&pageSize=10');
  });

  it.each([
    ['nombre del paciente', 'josé', 'search=jos%C3%A9'],
    ['código de 4 dígitos', 'PAC-0001', 'search=PAC-0001'],
    ['código de 6 dígitos', 'PAC-000001', 'search=PAC-000001'],
    ['nombre del cliente', 'ana', 'search=ana'],
    ['prefijo de cédula', '096144', 'search=096144'],
  ])('envía el criterio de %s', async (_label, search, encoded) => {
    vi.mocked(getJson).mockResolvedValue(page);

    await patientApi.searchPatients({ search });

    expect(getJson).toHaveBeenCalledWith(`/pets?${encoded}&page=1&pageSize=20`);
  });

  it('usa page 1 y pageSize 20 por defecto sin search', async () => {
    vi.mocked(getJson).mockResolvedValue(page);

    await patientApi.searchPatients();

    expect(getJson).toHaveBeenCalledWith('/pets?page=1&pageSize=20');
  });

  it('devuelve el envelope sin proyectarlo', async () => {
    vi.mocked(getJson).mockResolvedValue(page);

    await expect(patientApi.searchPatients({})).resolves.toEqual(page);
  });
});
