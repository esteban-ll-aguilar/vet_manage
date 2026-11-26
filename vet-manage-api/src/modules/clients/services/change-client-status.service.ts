import { Injectable } from '@nestjs/common';
import { ApiException } from '../../../common/errors/api-exception.js';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';
import { AUDIT_ACTIONS, AUDIT_MODULES, type AuditAction } from '../../audit/audit.catalog.js';
import { describePerson } from '../../audit/describe-person.js';
import { AuditService } from '../../audit/services/audit.service.js';

export const CLIENT_STATUS_MESSAGES = {
  notFound: 'Cliente no encontrado',
  deactivated: 'No se puede inactivar un cliente dado de baja',
  inactivated: 'Cliente inactivado correctamente',
  activateDeactivated: 'No se puede activar un cliente dado de baja',
  activated: 'Cliente activado correctamente',
  // HU-03 Dar de baja un cliente.
  reasonRequired: 'Ingrese el motivo de la baja',
  reasonTooLong: 'El motivo no puede superar 500 caracteres',
  alreadyDeactivated: 'El cliente está desactivado',
  deactivatedOk: 'Cliente dado de baja correctamente',
} as const;

export const DEACTIVATION_REASON_MAX = 500;

export type DeactivatedClientResult = {
  message: string;
  client: {
    id: string;
    status: 'DEACTIVATED';
    deactivatedAt: string;
    deactivationReason: string;
  };
};

type ReversibleStatus = 'ACTIVE' | 'INACTIVE';

type ClientStatusResult<S extends ReversibleStatus> = {
  message: string;
  client: {
    id: string;
    status: S;
  };
};

export type InactivatedClientResult = ClientStatusResult<'INACTIVE'>;
export type ActivatedClientResult = ClientStatusResult<'ACTIVE'>;

const STATUS_LABELS: Record<ReversibleStatus, string> = { ACTIVE: 'Activo', INACTIVE: 'Inactivo' };

type Transition<S extends ReversibleStatus> = {
  target: S;
  from: ReversibleStatus;
  action: AuditAction;
  deactivatedMessage: string;
  successMessage: string;
};

const INACTIVATE: Transition<'INACTIVE'> = {
  target: 'INACTIVE',
  from: 'ACTIVE',
  action: AUDIT_ACTIONS.inactivate,
  deactivatedMessage: CLIENT_STATUS_MESSAGES.deactivated,
  successMessage: CLIENT_STATUS_MESSAGES.inactivated,
};

const ACTIVATE: Transition<'ACTIVE'> = {
  target: 'ACTIVE',
  from: 'INACTIVE',
  action: AUDIT_ACTIONS.activate,
  deactivatedMessage: CLIENT_STATUS_MESSAGES.activateDeactivated,
  successMessage: CLIENT_STATUS_MESSAGES.activated,
};

// Cambios de estado del cliente: inactivar (HU-04), activar (HU-05) y dar de baja (HU-03, definitivo).
@Injectable()
export class ChangeClientStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  inactivate(clientId: string, actorId: string): Promise<InactivatedClientResult> {
    return this.change(clientId, actorId, INACTIVATE);
  }

  activate(clientId: string, actorId: string): Promise<ActivatedClientResult> {
    return this.change(clientId, actorId, ACTIVATE);
  }

  // Baja definitiva (HU-03): Activo o Inactivo → De baja, con motivo obligatorio. Conserva el cliente,
  // sus datos y sus pacientes; guarda fecha, responsable y motivo, y audita en la misma transacción.
  // La verificación de citas futuras pendientes (Esc. 2) queda pendiente de la aprobación del Módulo 2.
  async deactivate(clientId: string, reason: string | undefined, actorId: string): Promise<DeactivatedClientResult> {
    const trimmed = (reason ?? '').trim();
    if (!trimmed) {
      throw new ApiException(CLIENT_STATUS_MESSAGES.reasonRequired, 400, ['reason'], 'CLIENT_DEACTIVATION_REASON_REQUIRED');
    }
    if (trimmed.length > DEACTIVATION_REASON_MAX) {
      throw new ApiException(CLIENT_STATUS_MESSAGES.reasonTooLong, 400, ['reason'], 'CLIENT_DEACTIVATION_REASON_TOO_LONG');
    }

    const deactivatedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({
        where: { id: clientId },
        select: {
          id: true,
          status: true,
          person: { select: { identification: true, firstName: true, lastName: true } },
        },
      });

      if (!client) throw ApiException.notFound(CLIENT_STATUS_MESSAGES.notFound);
      if (client.status === 'DEACTIVATED') {
        throw new ApiException(CLIENT_STATUS_MESSAGES.alreadyDeactivated, 409, [], 'CLIENT_ALREADY_DEACTIVATED');
      }

      await tx.client.update({
        where: { id: clientId },
        data: { status: 'DEACTIVATED', deactivatedAt, deactivatedById: actorId, deactivationReason: trimmed },
      });

      await this.audit.record(tx, {
        actorId,
        action: AUDIT_ACTIONS.deactivate,
        module: AUDIT_MODULES.clients,
        affectedRecord: describePerson(client.person),
        previousValue: { status: STATUS_LABELS[client.status] },
        newValue: { status: 'De baja', reason: trimmed },
      });
    });

    return {
      message: CLIENT_STATUS_MESSAGES.deactivatedOk,
      client: { id: clientId, status: 'DEACTIVATED', deactivatedAt: deactivatedAt.toISOString(), deactivationReason: trimmed },
    };
  }

  private async change<S extends ReversibleStatus>(
    clientId: string,
    actorId: string,
    transition: Transition<S>,
  ): Promise<ClientStatusResult<S>> {
    await this.prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({
        where: { id: clientId },
        select: {
          id: true,
          status: true,
          person: { select: { identification: true, firstName: true, lastName: true } },
        },
      });

      if (!client) throw ApiException.notFound(CLIENT_STATUS_MESSAGES.notFound);
      // Un cliente dado de baja no vuelve a la gestión operativa (riesgo R-05).
      if (client.status === 'DEACTIVATED') {
        throw new ApiException(transition.deactivatedMessage, 400, [], 'CLIENT_STATUS_DEACTIVATED');
      }
      // Ya está en el estado pedido: no se escribe ni se audita de nuevo.
      if (client.status === transition.target) return;

      await tx.client.update({
        where: { id: clientId },
        data: { status: transition.target },
      });

      await this.audit.record(tx, {
        actorId,
        action: transition.action,
        module: AUDIT_MODULES.clients,
        affectedRecord: describePerson(client.person),
        previousValue: { status: STATUS_LABELS[transition.from] },
        newValue: { status: STATUS_LABELS[transition.target] },
      });
    });

    return {
      message: transition.successMessage,
      client: { id: clientId, status: transition.target },
    };
  }
}
