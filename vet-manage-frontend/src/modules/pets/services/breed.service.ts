import { getJson, postJson } from '../../../infrastructure/api/http-client';
import type { Breed, RegisterBreedDraft, SpeciesOption } from '../types';

export const breedApi = {
  registerBreed(draft: RegisterBreedDraft) {
    return postJson<Breed, RegisterBreedDraft>('/pets/breeds', draft);
  },
  // Razas activas de una especie, para el selector del registro de pacientes.
  listActiveBreeds(speciesId: string) {
    return getJson<SpeciesOption[]>(`/pets/species/${encodeURIComponent(speciesId)}/breeds`);
  },
};
