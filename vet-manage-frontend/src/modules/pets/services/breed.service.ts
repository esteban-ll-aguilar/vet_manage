import { getJson, patchJson, postJson } from '../../../infrastructure/api/http-client';
import type { Breed, BreedStatusChange, RegisterBreedDraft, SpeciesOption } from '../types';

export type BreedFilters = { search?: string; speciesId?: string };

export const breedApi = {
  // Búsqueda por nombre y filtro por especie (HU-20); sin filtros devuelve todas las razas.
  listBreeds(filters: BreedFilters = {}) {
    const params = new URLSearchParams();
    const search = filters.search?.trim();
    if (search) params.set('search', search);
    if (filters.speciesId) params.set('speciesId', filters.speciesId);
    const query = params.toString();
    return getJson<Breed[]>(`/pets/breeds${query ? `?${query}` : ''}`);
  },
  // Detalle de una raza en solo lectura (HU-20).
  getBreed(id: string) {
    return getJson<Breed>(`/pets/breeds/${encodeURIComponent(id)}`);
  },
  registerBreed(draft: RegisterBreedDraft) {
    return postJson<Breed, RegisterBreedDraft>('/pets/breeds', draft);
  },
  updateBreed(id: string, draft: RegisterBreedDraft) {
    return patchJson<Breed, RegisterBreedDraft>(`/pets/breeds/${encodeURIComponent(id)}`, draft);
  },
  inactivateBreed(id: string) {
    return patchJson<BreedStatusChange, Record<string, never>>(
      `/pets/breeds/${encodeURIComponent(id)}/inactivate`,
      {},
    );
  },
  activateBreed(id: string) {
    return patchJson<BreedStatusChange, Record<string, never>>(
      `/pets/breeds/${encodeURIComponent(id)}/activate`,
      {},
    );
  },
  // Razas activas de una especie, para el selector del registro de pacientes.
  listActiveBreeds(speciesId: string) {
    return getJson<SpeciesOption[]>(`/pets/species/${encodeURIComponent(speciesId)}/breeds`);
  },
};
