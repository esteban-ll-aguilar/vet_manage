import { Injectable, Logger } from '@nestjs/common';
import { ApiException } from '../../../common/errors/api-exception.js';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';
import { MailService } from '../../../infrastructure/mail/mail.service.js';
import { AUDIT_ACTIONS, AUDIT_MODULES } from '../../audit/audit.catalog.js';
import { describePerson } from '../../audit/describe-person.js';
import { AuditService } from '../../audit/services/audit.service.js';
import type { UpdateUserDto } from '../dtos/update-user.dto.js';
import { renderEmailChangedNotice } from '../templates/email-changed-notice.js';
import { validateUserContact, type UserContact } from './user-contact-rules.js';
import { findUserDetail, USER_DETAIL_MESSAGES, type UserDetail } from './user-detail.service.js';

export const UPDATE_USER_MESSAGES = {
  updated: 'Datos actualizados correctamente',
  notFound: USER_DETAIL_MESSAGES.notFound,
  deactivated: 'No se puede actualizar un usuario dado de baja',
  emailTaken: 'El correo ya se encuentra registrado',
} as const;

export type UpdateUserResult = {
  message: string;
  user: UserDetail;
  // true o false si el correo cambió y se intentó avisar al anterior; null si el correo no cambió.
  noticeSent: boolean | null;
};

type ContactField = keyof UserContact;
const CONTACT_FIELDS: ContactField[] = ['firstName', 'lastName', 'email', 'phone'];

const emailTaken = () => new ApiException(UPDATE_USER_MESSAGES.emailTaken, 409, ['email'], 'USER_EMAIL_TAKEN');

@Injectable()
export class UpdateUserService {
  private readonly logger = new Logger(UpdateUserService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  // Actualiza nombre, apellido, correo y teléfono de un usuario (HU-53). La cédula nunca se modifica.
  async update(id: string, input: UpdateUserDto, actorId: string): Promise<UpdateUserResult> {
    const data = validateUserContact(input);

    let outcome: { user: UserDetail; previousEmail: string | null };
    try {
      outcome = await this.prisma.$transaction(async (tx) => {
        const current = await findUserDetail(tx, id);
        if (!current) throw ApiException.notFound(UPDATE_USER_MESSAGES.notFound);
        if (current.status === 'DEACTIVATED') {
          throw new ApiException(UPDATE_USER_MESSAGES.deactivated, 409, [], 'USER_DEACTIVATED');
        }

        // El correo se compara sin mayúsculas: "Carlos@X.com" y "carlos@x.com" son el mismo correo.
        const changed = CONTACT_FIELDS.filter((field) =>
          field === 'email' ? data.email !== current.email.toLowerCase() : data[field] !== current[field]);
        if (changed.length === 0) return { user: current, previousEmail: null };

        if (changed.includes('email')) {
          // El correo es único en Person: cuenta cualquier otra persona, tenga usuario o solo sea cliente.
          const owner = await tx.person.findFirst({
            where: { email: { equals: data.email, mode: 'insensitive' }, id: { not: current.personId } },
            select: { id: true },
          });
          if (owner) throw emailTaken();
        }

        const values = Object.fromEntries(changed.map((field) => [field, data[field]]));
        await tx.person.update({ where: { id: current.personId }, data: values });

        await this.audit.record(tx, {
          actorId,
          action: AUDIT_ACTIONS.update,
          module: AUDIT_MODULES.users,
          affectedRecord: describePerson({ ...current, ...values }),
          previousValue: Object.fromEntries(changed.map((field) => [field, current[field]])),
          newValue: values,
        });

        return {
          user: { ...current, ...values },
          previousEmail: changed.includes('email') ? current.email : null,
        };
      });
    } catch (error) {
      // Dos guardados a la vez con el mismo correo: la restricción única de la base decide.
      if (typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002') throw emailTaken();
      throw error;
    }

    const noticeSent = outcome.previousEmail ? await this.sendNotice(outcome.user, outcome.previousEmail) : null;
    return { message: UPDATE_USER_MESSAGES.updated, user: outcome.user, noticeSent };
  }

  // El aviso va después de guardar: si el servidor de correo falla, el cambio se conserva y se informa.
  private async sendNotice(user: UserDetail, previousEmail: string): Promise<boolean> {
    try {
      const { subject, text, html } = renderEmailChangedNotice({
        firstName: user.firstName,
        previousEmail,
        newEmail: user.email,
      });
      await this.mail.send({ to: previousEmail, subject, text, html });
      return true;
    } catch (error) {
      this.logger.warn(`No se pudo avisar el cambio de correo del usuario ${user.id}: ${(error as Error).message}`);
      return false;
    }
  }
}
