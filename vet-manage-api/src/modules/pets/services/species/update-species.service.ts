import { Injectable } from '@nestjs/common';
import { ApiException } from '../../../../common/errors/api-exception.js';
import type { Species } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import { AUDIT_ACTIONS, AUDIT_MODULES } from '../../../audit/audit.catalog.js';
import { AuditService } from '../../../audit/services/audit.service.js';
import type { UpdateSpeciesDto } from '../../dtos/species/update-species.dto.js';
import { SpeciesRepository } from '../../repositories/species.repository.js';

@Injectable()
export class UpdateSpeciesService {
  constructor(
    private readonly speciesRepository: SpeciesRepository,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async execute(id: string, dto: UpdateSpeciesDto, actorId: string): Promise<Species> {
    const trimmedName = dto.name?.trim();
    if (!trimmedName) {
      throw ApiException.badRequest('El nombre de la especie es obligatorio');
    }

    const existing = await this.speciesRepository.findById(id);
    if (!existing) {
      throw ApiException.notFound('Especie no encontrada');
    }

    const duplicate = await this.speciesRepository.findByName(trimmedName);
    if (duplicate && duplicate.id !== id) {
      throw ApiException.conflict(`Ya existe una especie registrada con el nombre "${trimmedName}"`);
    }

    const normalizedDescription = dto.description?.trim() ? dto.description.trim() : null;
    if (existing.name === trimmedName && existing.description === normalizedDescription) {
      return existing;
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await this.speciesRepository.update(
        id,
        { name: trimmedName, description: normalizedDescription },
        tx,
      );

      await this.audit.record(tx, {
        actorId,
        action: AUDIT_ACTIONS.update,
        module: AUDIT_MODULES.species,
        affectedRecord: updated.name,
        previousValue: { name: existing.name, description: existing.description },
        newValue: { name: updated.name, description: updated.description },
      });

      return updated;
    });
  }
}
