import { Injectable } from '@nestjs/common';
import { ApiException } from '../../../../common/errors/api-exception.js';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import { AUDIT_ACTIONS, AUDIT_MODULES } from '../../../audit/audit.catalog.js';
import { AuditService } from '../../../audit/services/audit.service.js';
import { SpeciesRepository } from '../../repositories/species.repository.js';
import { RegisterSpeciesDto } from '../../dtos/species/register-species.dto.js';
import type { Species } from '../../../../generated/prisma/client.js';

@Injectable()
export class RegisterSpeciesService {
  constructor(
    private readonly speciesRepository: SpeciesRepository,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async execute(dto: RegisterSpeciesDto, actorId: string): Promise<Species> {
    const trimmedName = dto.name?.trim();

    if (!trimmedName) {
      throw ApiException.badRequest('El nombre de la especie es obligatorio');
    }

    const existing = await this.speciesRepository.findByName(trimmedName);
    if (existing) {
      throw ApiException.conflict(`Ya existe una especie registrada con el nombre "${trimmedName}"`);
    }

    return this.prisma.$transaction(async (tx) => {
      const created = await this.speciesRepository.create({ name: trimmedName, description: dto.description }, tx);
      await this.audit.record(tx, {
        actorId,
        action: AUDIT_ACTIONS.register,
        module: AUDIT_MODULES.species,
        affectedRecord: created.name,
      });
      return created;
    });
  }
}
