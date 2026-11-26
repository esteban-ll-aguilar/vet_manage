import { Injectable } from '@nestjs/common';
import { ApiException } from '../../../../common/errors/api-exception.js';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import { AUDIT_ACTIONS, AUDIT_MODULES } from '../../../audit/audit.catalog.js';
import { AuditService } from '../../../audit/services/audit.service.js';
import type { UpdateBreedDto } from '../../dtos/breeds/update-breed.dto.js';
import { BreedRepository, type BreedWithSpecies } from '../../repositories/breed.repository.js';
import { SpeciesRepository } from '../../repositories/species.repository.js';

const isUniqueViolation = (error: unknown) =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';

@Injectable()
export class UpdateBreedService {
  constructor(
    private readonly breedRepository: BreedRepository,
    private readonly speciesRepository: SpeciesRepository,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async execute(id: string, dto: UpdateBreedDto, actorId: string): Promise<BreedWithSpecies> {
    const trimmedName = dto.name?.trim();
    if (!trimmedName) {
      throw ApiException.badRequest('El nombre de la raza es obligatorio');
    }

    if (!dto.speciesId?.trim()) {
      throw ApiException.badRequest('La raza debe asociarse a una especie');
    }

    const existing = await this.breedRepository.findByIdWithSpecies(id);
    if (!existing) {
      throw ApiException.notFound('Raza no encontrada');
    }

    const species = await this.speciesRepository.findById(dto.speciesId);
    if (!species) {
      throw ApiException.notFound('La especie seleccionada no existe');
    }
    if (species.id !== existing.speciesId && !species.isActive) {
      throw ApiException.conflict('La especie seleccionada está inactiva');
    }

    const duplicateMessage = `Ya existe una raza "${trimmedName}" para la especie ${species.name}`;
    const duplicate = await this.breedRepository.findByNameInSpecies(species.id, trimmedName);
    if (duplicate && duplicate.id !== id) {
      throw ApiException.conflict(duplicateMessage);
    }

    const normalizedDescription = dto.description?.trim() ? dto.description.trim() : null;
    if (
      existing.name === trimmedName &&
      existing.speciesId === species.id &&
      existing.description === normalizedDescription
    ) {
      return existing;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await this.breedRepository.update(
          id,
          { name: trimmedName, speciesId: species.id, description: normalizedDescription },
          tx,
        );

        await this.audit.record(tx, {
          actorId,
          action: AUDIT_ACTIONS.update,
          module: AUDIT_MODULES.breeds,
          affectedRecord: `${updated.name} (${species.name})`,
          previousValue: {
            name: existing.name,
            species: existing.species.name,
            description: existing.description,
          },
          newValue: {
            name: updated.name,
            species: species.name,
            description: updated.description,
          },
        });

        return updated;
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw ApiException.conflict(duplicateMessage);
      throw error;
    }
  }
}
