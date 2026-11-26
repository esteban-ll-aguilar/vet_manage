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
import type { RegisterUserDto } from '../dtos/register-user.dto.js';
import { PasswordHasher } from './password-hasher.service.js';
import { generateTemporaryPassword } from './temporary-password.js';

export const USER_MESSAGES = {
  registered: 'Usuario registrado correctamente',
  mailFailed: 'Usuario registrado, pero no se pudo enviar el correo. Verifique la dirección y reenvíe las credenciales',
  missing: 'Complete los campos obligatorios',
  invalidIdentification: 'La cédula debe tener 10 dígitos válidos',
  invalidEmail: 'Ingrese un correo electrónico válido',
  invalidPhone: 'Ingrese un teléfono válido',
  invalidName: 'Los nombres y apellidos no pueden superar 100 caracteres',
  invalidRoles: 'Seleccione roles válidos del personal',
  identificationTaken: 'Número de cédula ya registrado',
  emailTaken: 'El correo ya se encuentra registrado',
} as const;

const PHONE_PATTERN = /^\+?\d{7,15}$/;
const NAME_MAX = 100;
const EMAIL_MAX = 255;

export type RegisteredUser = {
  id: string;
  personId: string;
  identification: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: string;
  roles: { name: string; displayName: string }[];
  existingPerson: boolean;
  // La cuenta recibió una contraseña temporal; si es false no hay credenciales que enviar.
  passwordAssigned: boolean;
  credentialsSent: boolean;
};

export type RegistrationResult = { message: string; user: RegisteredUser };

type ValidInput = {
  identification: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  roleNames: string[];
};

type StaffRole = { id: string; name: string; displayName: string };

@Injectable()
export class UserRegistrationService {
  private readonly logger = new Logger(UserRegistrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly hasher: PasswordHasher,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  // Roles activos del personal que se pueden asignar al registrar un usuario.
  listAssignableRoles() {
    return this.prisma.role.findMany({
      where: { isActive: true, category: 'STAFF' },
      select: { name: true, displayName: true, description: true },
      orderBy: { displayName: 'asc' },
    });
  }

  async register(input: RegisterUserDto, assignedById: string): Promise<RegistrationResult> {
    const data = validate(input);
    const roles = await this.findStaffRoles(data.roleNames);

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await this.hasher.hash(temporaryPassword);

    let outcome: Awaited<ReturnType<UserRegistrationService['persist']>>;
    try {
      outcome = await this.prisma.$transaction((tx) => this.persist(tx, data, roles, passwordHash, assignedById));
    } catch (error) {
      throw translateConflict(error);
    }

    const { person, user, passwordAssigned, existingPerson } = outcome;
    const credentialsSent = passwordAssigned
      ? await this.sendCredentials(person, roles, user.id, temporaryPassword)
      : false;

    return {
      message: passwordAssigned && !credentialsSent ? USER_MESSAGES.mailFailed : USER_MESSAGES.registered,
      user: {
        id: user.id,
        personId: person.id,
        identification: person.identification,
        firstName: person.firstName,
        lastName: person.lastName,
        email: person.email,
        phone: person.phone,
        status: user.status,
        roles: roles.map(({ name, displayName }) => ({ name, displayName })),
        existingPerson,
        passwordAssigned,
        credentialsSent,
      },
    };
  }

  private async findStaffRoles(names: string[]): Promise<StaffRole[]> {
    const roles = await this.prisma.role.findMany({
      where: { name: { in: names }, isActive: true, category: 'STAFF' },
      select: { id: true, name: true, displayName: true },
    });
    if (roles.length !== names.length) throw new ApiException(USER_MESSAGES.invalidRoles, 400, [], 'USER_INVALID_ROLES');
    return roles;
  }

  // Crea o reutiliza a la persona, asegura su cuenta y le agrega los roles; todo en una transacción.
  private async persist(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    data: ValidInput,
    roles: StaffRole[],
    passwordHash: string,
    assignedById: string,
  ) {
    const now = new Date();
    const found = await tx.person.findUnique({
      where: { identification: data.identification },
      include: {
        user: {
          include: {
            userRoles: {
              where: { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }], role: { isActive: true } },
              select: { role: { select: { category: true } } },
            },
          },
        },
      },
    });

    if (found?.user?.userRoles.some(({ role }) => role.category === 'STAFF')) {
      throw new ApiException(USER_MESSAGES.identificationTaken, 409, [], 'USER_IDENTIFICATION_TAKEN');
    }

    if (!found) {
      const emailOwner = await tx.person.findFirst({
        where: { email: { equals: data.email, mode: 'insensitive' } },
        select: { id: true },
      });
      if (emailOwner) throw new ApiException(USER_MESSAGES.emailTaken, 409, [], 'USER_EMAIL_TAKEN');
    }

    const person = found ?? await tx.person.create({
      data: {
        identification: data.identification,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
      },
    });

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

    await this.assignRoles(tx, user.id, roles, assignedById, now);
    await this.audit.record(tx, {
      actorId: assignedById,
      action: AUDIT_ACTIONS.register,
      module: AUDIT_MODULES.users,
      affectedRecord: describePerson(person),
      newValue: {
        identification: person.identification,
        firstName: person.firstName,
        lastName: person.lastName,
        email: person.email,
        roles: roles.map((role) => role.displayName).sort((a, b) => a.localeCompare(b, 'es')),
      },
    });

    return { person, user, passwordAssigned, existingPerson: Boolean(found) };
  }

  // Agrega los roles que faltan y renueva los que estaban vencidos.
  private async assignRoles(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    userId: string,
    roles: StaffRole[],
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

  // El fallo del correo no revierte el registro: se informa para que el Administrador reenvíe las credenciales.
  private async sendCredentials(
    person: { firstName: string; lastName: string; email: string },
    roles: StaffRole[],
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
      this.logger.warn(`No se pudieron enviar las credenciales del usuario ${userId}: ${(error as Error).message}`);
      return false;
    }
  }
}

function validate(input: RegisterUserDto): ValidInput {
  const identification = input.identification?.trim() ?? '';
  const firstName = input.firstName?.trim() ?? '';
  const lastName = input.lastName?.trim() ?? '';
  const email = input.email?.trim().toLowerCase() ?? '';
  const phone = input.phone?.trim() || null;
  const roleNames = [...new Set((input.roles ?? []).map((name) => name.trim()).filter(Boolean))];

  const missing = [
    !identification && 'identification',
    !firstName && 'firstName',
    !lastName && 'lastName',
    !email && 'email',
    roleNames.length === 0 && 'roles',
  ].filter((field): field is string => Boolean(field));
  if (missing.length > 0) throw new ApiException(USER_MESSAGES.missing, 400, missing, 'USER_MISSING_FIELDS');

  if (!isValidIdentification(identification)) {
    throw new ApiException(USER_MESSAGES.invalidIdentification, 400, ['identification'], 'USER_INVALID_IDENTIFICATION');
  }
  if (email.length > EMAIL_MAX || !isEmail(email)) {
    throw new ApiException(USER_MESSAGES.invalidEmail, 400, ['email'], 'USER_INVALID_EMAIL');
  }
  if (phone && !PHONE_PATTERN.test(phone)) {
    throw new ApiException(USER_MESSAGES.invalidPhone, 400, ['phone'], 'USER_INVALID_PHONE');
  }
  if (firstName.length > NAME_MAX || lastName.length > NAME_MAX) {
    throw new ApiException(USER_MESSAGES.invalidName, 400, ['firstName', 'lastName'], 'USER_INVALID_NAME');
  }

  return { identification, firstName, lastName, email, phone, roleNames };
}

// Una carrera entre dos registros iguales termina en una violación de unicidad: se responde como duplicado.
function translateConflict(error: unknown): unknown {
  if (typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002') {
    const detail = JSON.stringify((error as { meta?: unknown }).meta ?? '').toLowerCase();
    return detail.includes('email')
      ? new ApiException(USER_MESSAGES.emailTaken, 409, [], 'USER_EMAIL_TAKEN')
      : new ApiException(USER_MESSAGES.identificationTaken, 409, [], 'USER_IDENTIFICATION_TAKEN');
  }
  return error;
}
