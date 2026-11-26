import { getJson, patchJson, postJson } from '../../../infrastructure/api/http-client';
import type { Species, RegisterSpeciesDraft, SpeciesOption } from '../types';

export const speciesApi = {
  listSpecies() {
    return getJson<Species[]>('/pets/species');
  },
  registerSpecies(draft: RegisterSpeciesDraft) {
    return postJson<Species, RegisterSpeciesDraft>('/pets/species', draft);
  },
  updateSpecies(id: string, draft: RegisterSpeciesDraft) {
    return patchJson<Species, RegisterSpeciesDraft>(`/pets/species/${id}`, draft);
  },
  // Activa o inactiva la especie (HU-15).
  changeStatus(id: string, isActive: boolean) {
    return patchJson<Species, { isActive: boolean }>(`/pets/species/${id}/status`, { isActive });
  },
  listActiveSpecies() {
    return getJson<SpeciesOption[]>('/pets/species/active');
  },
};
