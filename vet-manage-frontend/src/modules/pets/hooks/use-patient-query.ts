import { useCallback, useEffect, useState } from 'react';
import { patientApi } from '../services/patient.service';
import type { PatientQuery, PatientSearchResponse } from '../types';

export const PATIENT_SEARCH_VALIDATION_MESSAGE =
  'Ingrese al menos 2 caracteres para buscar por nombre o el código del paciente';
export const EMPTY_RESULT_MESSAGE = 'No se encontraron pacientes que coincidan con la búsqueda';

const emptyResult = (query: PatientQuery): PatientSearchResponse => ({
  items: [],
  total: 0,
  page: query.page ?? 1,
  pageSize: query.pageSize ?? 20,
  totalPages: 0,
});

export function usePatientQuery() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState<PatientQuery>({ page: 1, pageSize: 20 });
  const [result, setResult] = useState<PatientSearchResponse>(() => emptyResult({ page: 1, pageSize: 20 }));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // La carga inicial muestra el listado completo; los cambios de query vuelven a pedirlo.
  useEffect(() => {
    let cancelled = false;

    patientApi.searchPatients(query)
      .then((page) => {
        if (!cancelled) setResult(page);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setResult(emptyResult(query));
        setError(cause instanceof Error ? cause.message : 'No se pudo cargar la lista de pacientes.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  // Escenario 7 de la HU: buscar sin criterio no ejecuta una nueva consulta.
  const runSearch = useCallback(() => {
    const term = search.trim();
    if (!term) {
      setValidationError(null);
      return;
    }
    if (term.length < 2) {
      setValidationError(PATIENT_SEARCH_VALIDATION_MESSAGE);
      return;
    }
    setValidationError(null);
    const next = { ...query, search: term, page: 1 };
    if (next.search !== query.search || next.page !== query.page) {
      setLoading(true);
      setError(null);
      setQuery(next);
    }
  }, [query, search]);

  const clearSearch = useCallback(() => {
    setSearch('');
    setValidationError(null);
    const next = { ...query, search: undefined, page: 1 };
    if (next.search !== query.search || next.page !== query.page) {
      setLoading(true);
      setError(null);
      setQuery(next);
    }
  }, [query]);

  const goToPage = useCallback((page: number) => {
    if (page === query.page) return;
    setLoading(true);
    setError(null);
    setQuery({ ...query, page });
  }, [query]);

  return {
    search,
    setSearch,
    query,
    result,
    loading,
    error,
    validationError,
    setValidationError,
    runSearch,
    clearSearch,
    goToPage,
    totalPages: Math.max(1, result.totalPages || Math.ceil(result.total / result.pageSize)),
  };
}
