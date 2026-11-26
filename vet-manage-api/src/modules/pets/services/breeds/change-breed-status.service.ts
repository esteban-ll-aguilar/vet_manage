import { Injectable } from '@nestjs/common';
import { ApiException } from '../../../../common/errors/api-exception.js';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import { AUDIT_ACTIONS, AUDIT_MODULES } from '../../../audit/audit.catalog.js';
import { AuditService } from '../../../audit/services/audit.service.js';

export const BREED_STATUS_MESSAGES = {
  notFound: 'Raza no encontrada',
  inactivated: 'Raza inactivada correctamente',
  activated: 'Raza activada correctamente',
} as const;

export type ChangedBreedStatusResult = {
  message: string;
  breed: {
    id: string;
    isActive: boolean;
    updatedAt: Date;
  };
};

@Injectable()
export class ChangeBreedStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  inactivate(breedId: string, actorId: string): Promise<ChangedBreedStatusResult> {
    return this.changeStatus(breedId, false, actorId);
  }

  activate(breedId: string, actorId: string): Promise<ChangedBreedStatusResult> {
    return this.changeStatus(breedId, true, actorId);
  }

  private changeStatus(breedId: string, isActive: boolean, actorId: string): Promise<ChangedBreedStatusResult> {
    return this.prisma.$transaction(async (tx) => {
      const breed = await tx.breed.findUnique({
        where: { id: breedId },
        select: {
          id: true,
          name: true,
          isActive: true,
          updatedAt: true,
          species: { select: { name: true } },
        },
      });

      if (!breed) throw ApiException.notFound(BREED_STATUS_MESSAGES.notFound);

      const message = isActive ? BREED_STATUS_MESSAGES.activated : BREED_STATUS_MESSAGES.inactivated;
      if (breed.isActive === isActive) {
        return { message, breed: { id: breed.id, isActive: breed.isActive, updatedAt: breed.updatedAt } };
      }

      const updatedBreed = await tx.breed.update({
        where: { id: breedId },
        data: { isActive },
        select: { id: true, isActive: true, updatedAt: true },
      });

      await this.audit.record(tx, {
        actorId,
        action: isActive ? AUDIT_ACTIONS.activate : AUDIT_ACTIONS.inactivate,
        module: AUDIT_MODULES.breeds,
        affectedRecord: `${breed.name} (${breed.species.name})`,
        previousValue: { status: breed.isActive ? 'Activa' : 'Inactiva' },
        newValue: { status: isActive ? 'Activa' : 'Inactiva' },
      });

      return { message, breed: updatedBreed };
    });
  }
}
