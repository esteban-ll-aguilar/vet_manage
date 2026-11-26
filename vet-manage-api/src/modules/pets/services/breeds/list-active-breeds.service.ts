import { Injectable } from '@nestjs/common';
import { BreedRepository } from '../../repositories/breed.repository.js';

@Injectable()
export class ListActiveBreedsService {
  constructor(private readonly breedRepository: BreedRepository) {}

  execute(speciesId: string) {
    return this.breedRepository.findActiveBySpecies(speciesId);
  }
}
