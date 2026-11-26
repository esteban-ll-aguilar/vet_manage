import { Injectable } from '@nestjs/common';
import { ApiException } from '../../../../common/errors/api-exception.js';
import type { ListBreedsQueryDto } from '../../dtos/breeds/list-breeds-query.dto.js';
import { BreedRepository, type BreedWithSpecies } from '../../repositories/breed.repository.js';
import { searchVariants } from '../search-variants.js';

export const FIND_BREEDS_MESSAGES = {
  found: 'Razas consultadas correctamente',
  empty: 'No se encontraron razas con el criterio ingresado',
  notFound: 'Raza no encontrada',
} as const;

// Consulta de razas (HU-20). Solo lee: no registra auditoría.
@Injectable()
export class FindBreedsService {
  constructor(private readonly breedRepository: BreedRepository) {}

  async list(query: ListBreedsQueryDto = {}): Promise<{ breeds: BreedWithSpecies[]; message: string }> {
    const search = query.search?.trim();
    const breeds = await this.breedRepository.findByFilters({
      speciesId: query.speciesId,
      nameVariants: search ? searchVariants(search) : undefined,
    });
    return { breeds, message: breeds.length > 0 ? FIND_BREEDS_MESSAGES.found : FIND_BREEDS_MESSAGES.empty };
  }

  async findById(id: string): Promise<BreedWithSpecies> {
    const breed = await this.breedRepository.findByIdWithSpecies(id);
    if (!breed) throw ApiException.notFound(FIND_BREEDS_MESSAGES.notFound);
    return breed;
  }
}
