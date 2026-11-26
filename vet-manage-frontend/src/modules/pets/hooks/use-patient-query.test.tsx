import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { patientApi } from '../services/patient.service';
import { PATIENT_SEARCH_VALIDATION_MESSAGE, usePatientQuery } from './use-patient-query';

vi.mock('../services/patient.service', () => ({ patientApi: { searchPatients: vi.fn() } }));

const patient = {
  id: 'pt-1',
  code: 'PAC-000001',
  name: 'Firulais',
  gender: 'MALE' as const,
  birthDate: '10-05-2024',
  weightKg: 12.5,
  heightCm: 45,
  reproductiveStatus: 'STERILIZED' as const,
  color: null,
  status: 'ACTIVE' as const,
  client: { identification: '0961441234', firstName: 'Ana', lastName: 'Pérez' },
  species: { id: 'sp-1', name: 'Canino' },
  breed: { id: 'br-1', name: 'Labrador' },
};

const page = (overrides: Record<string, unknown> = {}) => ({
  items: [patient],
  total: 1,
  page: 1,
  pageSize: 20,
  totalPages: 1,
  ...overrides,
});

describe('usePatientQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(patientApi.searchPatients).mockResolvedValue(page());
  });

  it('carga el listado completo al montar', async () => {
    const { result } = renderHook(() => usePatientQuery());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(patientApi.searchPatients).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
    expect(result.current.result.items).toEqual([patient]);
    expect(result.current.totalPages).toBe(1);
  });

  it('no consulta con un término de un carácter y muestra la validación', async () => {
    const { result } = renderHook(() => usePatientQuery());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setSearch('a'));
    act(() => result.current.runSearch());

    expect(result.current.validationError).toBe(PATIENT_SEARCH_VALIDATION_MESSAGE);
    expect(patientApi.searchPatients).toHaveBeenCalledTimes(1);
  });

  it('busca con el término recortado y reinicia la página', async () => {
    const { result } = renderHook(() => usePatientQuery());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setSearch('  jos  '));
    act(() => result.current.goToPage(3));
    await waitFor(() => expect(patientApi.searchPatients).toHaveBeenLastCalledWith({ page: 3, pageSize: 20 }));

    act(() => result.current.runSearch());

    await waitFor(() => expect(patientApi.searchPatients).toHaveBeenLastCalledWith({
      search: 'jos', page: 1, pageSize: 20,
    }));
    expect(result.current.validationError).toBeNull();
  });

  it('buscar sin criterio no ejecuta una nueva consulta', async () => {
    const { result } = renderHook(() => usePatientQuery());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.runSearch());

    expect(patientApi.searchPatients).toHaveBeenCalledTimes(1);
  });

  it('limpia el término y restablece la página 1', async () => {
    const { result } = renderHook(() => usePatientQuery());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setSearch('ana'));
    act(() => result.current.runSearch());
    await waitFor(() => expect(patientApi.searchPatients).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'ana' }),
    ));

    act(() => result.current.clearSearch());

    expect(result.current.search).toBe('');
    expect(result.current.validationError).toBeNull();
    await waitFor(() => expect(patientApi.searchPatients).toHaveBeenLastCalledWith({ page: 1, pageSize: 20 }));
  });

  it('muestra un error y un resultado vacío si la API falla', async () => {
    vi.mocked(patientApi.searchPatients).mockRejectedValueOnce(new Error('No se pudo cargar la lista de pacientes.'));
    const { result } = renderHook(() => usePatientQuery());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('No se pudo cargar la lista de pacientes.');
    expect(result.current.result.items).toEqual([]);
    expect(result.current.totalPages).toBe(1);
  });
});
