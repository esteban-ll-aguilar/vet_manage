import { Injectable } from '@nestjs/common';
import { ApiException } from '../../../../common/errors/api-exception.js';
import type { Species } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import { AUDIT_ACTIONS, AUDIT_MODULES } from '../../../audit/audit.catalog.js';
import { AuditService } from '../../../audit/services/audit.service.js';
import { SpeciesRepository } from '../../repositories/species.repository.js';

export const SPECIES_STATUS_MESSAGES = {
  notFound: 'Especie no encontrada',
  inactivated: 'Especie inactivada correctamente',
  activated: 'Especie activada correctamente',
} as const;

const statusLabel = (isActive: boolean) => (isActive ? 'Activa' : 'Inactiva');

export type ChangedSpeciesStatus = { message: string; species: Species };

// Activa o inactiva una especie (HU-15). Sus razas y pacientes no cambian: una especie inactiva
// solo deja de ofrecerse para registros nuevos, porque razas y pacientes ya exigen especies activas (R-07).
@Injectable()
export class ChangeSpeciesStatusService {
  constructor(
    private readonly speciesRepository: SpeciesRepository,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async execute(id: string, isActive: boolean, actorId: string): Promise<ChangedSpeciesStatus> {
    const message = isActive ? SPECIES_STATUS_MESSAGES.activated : SPECIES_STATUS_MESSAGES.inactivated;

    const species = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.species.findUnique({ where: { id } });
      if (!existing) throw ApiException.notFound(SPECIES_STATUS_MESSAGES.notFound);
      // Ya está en el estado pedido: no se escribe ni se audita de nuevo.
      if (existing.isActive === isActive) return existing;

      const updated = await this.speciesRepository.updateStatus(id, isActive, tx);
      await this.audit.record(tx, {
        actorId,
        action: isActive ? AUDIT_ACTIONS.activate : AUDIT_ACTIONS.inactivate,
        module: AUDIT_MODULES.species,
        affectedRecord: updated.name,
        previousValue: { status: statusLabel(existing.isActive) },
        newValue: { status: statusLabel(isActive) },
      });
      return updated;
    });

    return { message, species };
  }
}
