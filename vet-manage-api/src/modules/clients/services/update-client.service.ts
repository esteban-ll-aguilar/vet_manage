import { Injectable } from '@nestjs/common';
import { ApiException } from '../../../common/errors/api-exception.js';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';
import { AUDIT_ACTIONS, AUDIT_MODULES } from '../../audit/audit.catalog.js';
import { describePerson } from '../../audit/describe-person.js';
import { AuditService } from '../../audit/services/audit.service.js';
import { CLIENT_MESSAGES } from '../../identity/services/client-registration.service.js';
import type { ClientStatus } from '../dtos/client-response.dto.js';
import type { UpdateClientDto } from '../dtos/update-client.dto.js';
import { validateClientContact, type ClientContact } from './client-contact-rules.js';

export const CLIENT_UPDATE_MESSAGES = {
  updated: 'Datos actualizados correctamente',
  notFound: 'Cliente no encontrado',
  deactivated: 'No se puede actualizar un cliente dado de baja',
  emailLocked: 'El correo de este cliente también es el de su cuenta del personal; solo el Administrador puede cambiarlo',
} as const;

export type UpdatedClient = {
  id: string;
  identification: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  address: string | null;
  status: ClientStatus;
};

export type UpdateClientResult = { message: string; client: UpdatedClient };

type ContactField = keyof ClientContact;
const CONTACT_FIELDS: ContactField[] = ['firstName', 'lastName', 'email', 'phone', 'address'];
const CLIENT_ROLE_CATEGORY = 'CLIENT';

@Injectable()
export class UpdateClientService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // Actualiza los datos de contacto del cliente (HU-02). La cédula nunca se modifica.
  async update(clientId: string, input: UpdateClientDto, actorId: string): Promise<UpdateClientResult> {
    const data = validateClientContact(input);

    try {
      const client = await this.prisma.$transaction(async (tx) => {
        const now = new Date();
        const current = await tx.client.findUnique({
          where: { id: clientId },
          select: {
            id: true,
            status: true,
            person: {
              select: {
                id: true,
                identification: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                address: true,
                user: {
                  select: {
                    // Roles vigentes: activos y sin vencer, igual que el listado de clientes.
                    userRoles: {
                      where: { role: { isActive: true }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
                      select: { role: { select: { category: true } } },
                    },
                  },
                },
              },
            },
          },
        });

        if (!current) throw ApiException.notFound(CLIENT_UPDATE_MESSAGES.notFound);
        if (current.status === 'DEACTIVATED') {
          throw new ApiException(CLIENT_UPDATE_MESSAGES.deactivated, 409, [], 'CLIENT_DEACTIVATED');
        }

        const { person } = current;
        // El correo se compara sin mayúsculas: "Ana@x.com" y "ana@x.com" son el mismo correo.
        const changed = CONTACT_FIELDS.filter((field) =>
          field === 'email' ? data.email !== person.email.toLowerCase() : data[field] !== person[field]);

        if (changed.includes('email')) {
          // El correo es el de inicio de sesión: si la persona es del personal, solo lo cambia el Administrador.
          const isStaff = person.user?.userRoles.some(({ role }) => role.category !== CLIENT_ROLE_CATEGORY) ?? false;
          if (isStaff) throw new ApiException(CLIENT_UPDATE_MESSAGES.emailLocked, 409, ['email'], 'CLIENT_EMAIL_LOCKED');

          const emailOwner = await tx.person.findFirst({
            where: { email: { equals: data.email, mode: 'insensitive' }, id: { not: person.id } },
            select: { id: true },
          });
          if (emailOwner) throw new ApiException(CLIENT_MESSAGES.emailTaken, 409, ['email'], 'CLIENT_EMAIL_TAKEN');
        }

        const unchanged = { ...person, id: current.id, status: current.status };
        if (changed.length === 0) return unchanged;

        const updated = await tx.person.update({
          where: { id: person.id },
          data: Object.fromEntries(changed.map((field) => [field, data[field]])),
        });

        await this.audit.record(tx, {
          actorId,
          action: AUDIT_ACTIONS.update,
          module: AUDIT_MODULES.clients,
          affectedRecord: describePerson(updated),
          previousValue: Object.fromEntries(changed.map((field) => [field, person[field]])),
          newValue: Object.fromEntries(changed.map((field) => [field, data[field]])),
        });

        return { ...updated, id: current.id, status: current.status };
      });

      return {
        message: CLIENT_UPDATE_MESSAGES.updated,
        client: {
          id: client.id,
          identification: client.identification,
          firstName: client.firstName,
          lastName: client.lastName,
          email: client.email,
          phone: client.phone,
          address: client.address,
          status: client.status,
        },
      };
    } catch (error) {
      // Dos guardados a la vez con el mismo correo: la restricción única de la base decide.
      if (typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002') {
        throw new ApiException(CLIENT_MESSAGES.emailTaken, 409, ['email'], 'CLIENT_EMAIL_TAKEN');
      }
      throw error;
    }
  }
}
