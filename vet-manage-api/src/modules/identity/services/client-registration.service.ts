import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isEmail } from 'class-validator';
import { ApiException } from '../../../common/errors/api-exception.js';
import { isValidIdentification } from '../../../common/validation/identification.js';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';
import { MailService } from '../../../infrastructure/mail/mail.service.js';
import { renderCredentialsEmail } from '../../../infrastructure/mail/templates/credentials-email.js';
import { AUDIT_ACTIONS, AUDIT_MODULES } from '../../audit/audit.catalog.js';
import { describePerson } from '../../audit/describe-person.js';
import { AuditService } from '../../audit/services/audit.service.js';
import type { ClientRegistrationDto } from '../dtos/client-registration.dto.js';
import { PasswordHasher } from './password-hasher.service.js';
import { generateTemporaryPassword } from './temporary-password.js';

export const CLIENT_MESSAGES = {
  registered: 'Cliente registrado exitosamente',
  mailFailed: 'Cliente registrado, pero no se pudo enviar el correo. Verifique la dirección y reenvíe las credenciales',
  missing: 'Por favor, complete todos los campos obligatorios',
  invalidIdentification: 'Número de cédula no válido',
  invalidEmail: 'Por favor, ingrese un correo y número de teléfono válido',
  invalidPhone: 'Por favor, ingrese un correo y número de teléfono válido',
  invalidName: 'Los nombres y apellidos no pueden superar 100 caracteres',
  missingClientRole: 'No se encontró el rol de cliente activo',
  invalidAddress: 'Dirección no válida',
  identificationTaken: 'Número de cédula ya registrado',
  emailTaken: 'El correo ya se encuentra registrado',
} as const;

const PHONE_PATTERN = /^09\d{8}$/;
const NAME_MAX = 100;
const EMAIL_MAX = 255;
const ADDRESS_MAX = 255;

// Límites del contacto del cliente; también los usa la actualización de clientes (HU-02).
export const CLIENT_CONTACT_LIMITS = {
  phonePattern: PHONE_PATTERN,
  nameMax: NAME_MAX,
  emailMax: EMAIL_MAX,
  addressMax: ADDRESS_MAX,
} as const;
const CLIENT_ROLE_NAME = 'client';

export type RegisteredClient = {
  id: string;
  personId: string;
  identification: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  address: string | null;
  status: string;
  roles: { name: string; displayName: string }[];
  existingPerson: boolean;
  passwordAssigned: boolean;
  credentialsSent: boolean;
};

export type ClientRegistrationResult = { message: string; client: RegisteredClient };

type ValidInput = {
  identification: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  address: string | null;
};

type RoleRef = { id: string; name: string; displayName: string };

@Injectable()
export class ClientRegistrationService {
  private readonly logger = new Logger(ClientRegistrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly hasher: PasswordHasher,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  // El registro de clientes siempre asigna el rol de la categoría CLIENT.
  listAssignableRoles() {
    return this.prisma.role.findMany({
      where: { isActive: true, category: 'CLIENT' },
      select: { name: true, displayName: true, description: true },
      orderBy: { displayName: 'asc' },
    });
  }

  async register(input: ClientRegistrationDto, assignedById: string): Promise<ClientRegistrationResult> {
    const data = this.validate(input);
    const role = await this.findClientRole();

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await this.hasher.hash(temporaryPassword);

    let outcome: Awaited<ReturnType<ClientRegistrationService['persist']>>;
    try {
      outcome = await this.prisma.$transaction((tx) => this.persist(tx, data, role, passwordHash, assignedById));
    } catch (error) {
      throw this.translateConflict(error);
    }

    const { person, user, client, passwordAssigned, existingPerson } = outcome;
    const credentialsSent = passwordAssigned
      ? await this.sendCredentials(person, [role], user.id, temporaryPassword)
      : false;

    return {
      message: passwordAssigned && !credentialsSent ? CLIENT_MESSAGES.mailFailed : CLIENT_MESSAGES.registered,
      client: {
        id: client.id,
        personId: person.id,
        identification: person.identification,
        firstName: person.firstName,
        lastName: person.lastName,
        email: person.email,
        phone: person.phone,
        address: person.address,
        status: client.status,
        roles: [{ name: role.name, displayName: role.displayName }],
        existingPerson,
        passwordAssigned,
        credentialsSent,
      },
    };
  }

  private async findClientRole(): Promise<RoleRef> {
    const role = await this.prisma.role.findFirst({
      where: { name: CLIENT_ROLE_NAME, isActive: true, category: 'CLIENT' },
      select: { id: true, name: true, displayName: true },
    });
    if (!role) throw new ApiException(CLIENT_MESSAGES.missingClientRole, 500, [], 'CLIENT_ROLE_MISSING');
    return role;
  }

  private async persist(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    data: ValidInput,
    role: RoleRef,
    passwordHash: string,
    assignedById: string,
  ) {
    const now = new Date();
    const found = await tx.person.findUnique({
      where: { identification: data.identification },
      include: {
        client: { select: { id: true } },
        user: { select: { id: true, password: true, status: true } },
      },
    });

    if (found?.client) {
      throw new ApiException(CLIENT_MESSAGES.identificationTaken, 409, [], 'CLIENT_IDENTIFICATION_TAKEN');
    }

    if (!found) {
      const emailOwner = await tx.person.findFirst({
        where: { email: { equals: data.email, mode: 'insensitive' } },
        select: { id: true },
      });
      if (emailOwner) throw new ApiException(CLIENT_MESSAGES.emailTaken, 409, [], 'CLIENT_EMAIL_TAKEN');
    }

    let person = found ?? await tx.person.create({
      data: {
        identification: data.identification,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        address: data.address,
      },
    });

    if (found && !found.address && data.address) {
      person = await tx.person.update({ where: { id: person.id }, data: { address: data.address } });
    }

    const select = { id: true, status: true } as const;
    let user: { id: string; status: string };
    let passwordAssigned = true;
    if (!found?.user) {
      user = await tx.user.create({ data: { personId: person.id, password: passwordHash, mustChangePassword: true }, select });
    } else if (!found.user.password) {
      user = await tx.user.update({ where: { id: found.user.id }, data: { password: passwordHash, mustChangePassword: true }, select });
    } else {
      user = found.user;
      passwordAssigned = false;
    }

    await this.assignRoles(tx, user.id, [role], assignedById, now);

    const client = await tx.client.upsert({
      where: { personId: person.id },
      create: { personId: person.id, status: 'ACTIVE' },
      update: {},
    });
    await this.audit.record(tx, {
      actorId: assignedById,
      action: AUDIT_ACTIONS.register,
      module: AUDIT_MODULES.clients,
      affectedRecord: describePerson(person),
    });

    return { person, user, client, passwordAssigned, existingPerson: Boolean(found) };
  }

  private async assignRoles(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    userId: string,
    roles: RoleRef[],
    assignedById: string,
    now: Date,
  ) {
    const existing = await tx.userRole.findMany({
      where: { userId, roleId: { in: roles.map((role) => role.id) } },
      select: { id: true, roleId: true, expiresAt: true },
    });
    const byRole = new Map(existing.map((assignment) => [assignment.roleId, assignment]));

    for (const role of roles) {
      const assignment = byRole.get(role.id);
      if (!assignment) {
        await tx.userRole.create({ data: { userId, roleId: role.id, assignedById } });
      } else if (assignment.expiresAt && assignment.expiresAt <= now) {
        await tx.userRole.update({ where: { id: assignment.id }, data: { expiresAt: null, assignedById } });
      }
    }
  }

  private async sendCredentials(
    person: { firstName: string; lastName: string; email: string },
    roles: RoleRef[],
    userId: string,
    password: string,
  ): Promise<boolean> {
    try {
      const baseUrl = this.config.get<string>('app.url') ?? '';
      const { subject, text, html } = renderCredentialsEmail({
        ...person,
        password,
        roles: roles.map((role) => role.displayName),
        loginUrl: `${baseUrl.replace(/\/$/, '')}/login`,
      });
      await this.mail.send({ to: person.email, subject, text, html });
      return true;
    } catch (error) {
      this.logger.warn(`No se pudieron enviar las credenciales del cliente ${userId}: ${(error as Error).message}`);
      return false;
    }
  }

  private validate(input: ClientRegistrationDto): ValidInput {
    const identification = input.identification?.trim() ?? '';
    const firstName = input.firstName?.trim() ?? '';
    const lastName = input.lastName?.trim() ?? '';
    const email = input.email?.trim().toLowerCase() ?? '';
    const phone = input.phone?.trim() || null;
    const address = input.address?.trim() || null;

    const missing = [
      !identification && 'identification',
      !firstName && 'firstName',
      !lastName && 'lastName',
      !email && 'email',
      !phone && 'phone',
    ].filter((field): field is string => Boolean(field));
    if (missing.length > 0) throw new ApiException(CLIENT_MESSAGES.missing, 400, missing, 'CLIENT_MISSING_FIELDS');

    if (!isValidIdentification(identification)) {
      throw new ApiException(CLIENT_MESSAGES.invalidIdentification, 400, ['identification'], 'CLIENT_INVALID_IDENTIFICATION');
    }
    if (email.length > EMAIL_MAX || !isEmail(email)) {
      throw new ApiException(CLIENT_MESSAGES.invalidEmail, 400, ['email'], 'CLIENT_INVALID_EMAIL');
    }
    if (phone && !PHONE_PATTERN.test(phone)) {
      throw new ApiException(CLIENT_MESSAGES.invalidPhone, 400, ['phone'], 'CLIENT_INVALID_PHONE');
    }
    if (address && address.length > ADDRESS_MAX) {
      throw new ApiException(CLIENT_MESSAGES.invalidAddress, 400, ['address'], 'CLIENT_INVALID_ADDRESS');
    }
    if (firstName.length > NAME_MAX || lastName.length > NAME_MAX) {
      throw new ApiException(CLIENT_MESSAGES.invalidName, 400, ['firstName', 'lastName'], 'CLIENT_INVALID_NAME');
    }

    return { identification, firstName, lastName, email, phone, address };
  }

  private translateConflict(error: unknown): unknown {
    if (typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002') {
      const detail = JSON.stringify((error as { meta?: unknown }).meta ?? '').toLowerCase();
      return detail.includes('email')
        ? new ApiException(CLIENT_MESSAGES.emailTaken, 409, [], 'CLIENT_EMAIL_TAKEN')
        : new ApiException(CLIENT_MESSAGES.identificationTaken, 409, [], 'CLIENT_IDENTIFICATION_TAKEN');
    }
    return error;
  }
}
