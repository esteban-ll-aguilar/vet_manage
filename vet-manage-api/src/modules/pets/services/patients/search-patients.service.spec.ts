import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SearchPatientsQueryDto } from '../../dtos/patients/search-patients-query.dto.js';
import type { PatientSearchQuery, PatientSearchRecord } from '../../repositories/patient.repository.js';
import { PATIENT_QUERY_MESSAGES, SearchPatientsService } from './search-patients.service.js';

const patientRecord = (overrides: Partial<PatientSearchRecord> = {}): PatientSearchRecord => ({
  id: 'p1',
  code: 'PAC-000001',
  name: 'José',
  gender: 'MALE',
  birthDate: new Date('2020-05-10T00:00:00.000Z'),
  weightKg: 12.5 as never,
  heightCm: 60 as never,
  reproductiveStatus: 'NOT_STERILIZED',
  color: null,
  status: 'ACTIVE',
  createdAt: new Date('2026-11-19T12:00:00.000Z'),
  client: {
    person: { identification: '0961441234', firstName: 'Ana', lastName: 'Pérez' },
  },
  species: { id: 's1', name: 'Canino' },
  breed: { id: 'b1', name: 'Labrador' },
  ...overrides,
});

function build() {
  const searchPatients = vi.fn(async (_query: PatientSearchQuery) => ({
    patients: [patientRecord()],
    total: 1,
  }));
  const repository = { searchPatients };
  const service = new SearchPatientsService(repository as never);
  return { service, searchPatients };
}

const query = (overrides: Partial<SearchPatientsQueryDto> = {}): SearchPatientsQueryDto => ({
  page: 1,
  pageSize: 20,
  ...overrides,
});

describe('SearchPatientsService', () => {
  let ctx: ReturnType<typeof build>;

  beforeEach(() => {
    ctx = build();
  });

  it('devuelve el envelope paginado con birthDate DD-MM-YYYY y medidas numéricas', async () => {
    const result = await ctx.service.search(query());

    expect(result).toEqual({
      items: [{
        id: 'p1',
        code: 'PAC-000001',
        name: 'José',
        gender: 'MALE',
        birthDate: '10-05-2020',
        weightKg: 12.5,
        heightCm: 60,
        reproductiveStatus: 'NOT_STERILIZED',
        color: null,
        status: 'ACTIVE',
        client: { firstName: 'Ana', lastName: 'Pérez', identification: '0961441234' },
        species: { id: 's1', name: 'Canino' },
        breed: { id: 'b1', name: 'Labrador' },
      }],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
  });

  it('pasa el término, la página y el tamaño al repositorio', async () => {
    await ctx.service.search(query({ search: 'josé', page: 2, pageSize: 10 }));
    expect(ctx.searchPatients).toHaveBeenCalledWith({ search: 'josé', page: 2, pageSize: 10 });
  });

  it('quita espacios exteriores del término antes de delegar', async () => {
    await ctx.service.search(query({ search: '  ana  ' }));
    expect(ctx.searchPatients).toHaveBeenCalledWith({ search: 'ana', page: 1, pageSize: 20 });
  });

  it('rechaza un término de un carácter con el mensaje de la HU', async () => {
    await expect(ctx.service.search(query({ search: 'a' }))).rejects.toMatchObject({
      statusCode: 400,
      message: PATIENT_QUERY_MESSAGES.shortSearch,
    });
    expect(ctx.searchPatients).not.toHaveBeenCalled();
  });

  it('devuelve totalPages 0 cuando no hay coincidencias', async () => {
    ctx.searchPatients.mockResolvedValue({ patients: [], total: 0 });
    const result = await ctx.service.search(query({ search: 'zzzz' }));
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it('incluye pacientes en cualquier estado', async () => {
    ctx.searchPatients.mockResolvedValue({
      patients: [
        patientRecord({ id: 'p1', status: 'ACTIVE' }),
        patientRecord({ id: 'p2', status: 'INACTIVE' }),
        patientRecord({ id: 'p3', status: 'DEACTIVATED' }),
      ],
      total: 3,
    });
    const result = await ctx.service.search(query({ search: 'jos' }));
    expect(result.items.map((item) => item.status)).toEqual(['ACTIVE', 'INACTIVE', 'DEACTIVATED']);
  });

  it('calcula totalPages con ceil cuando sobra una página', async () => {
    ctx.searchPatients.mockResolvedValue({ patients: [patientRecord()], total: 21 });
    const result = await ctx.service.search(query({ pageSize: 20 }));
    expect(result.totalPages).toBe(2);
  });
});
