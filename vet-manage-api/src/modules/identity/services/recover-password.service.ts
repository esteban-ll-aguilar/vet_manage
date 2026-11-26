import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isEmail } from 'class-validator';
import { createHash, randomBytes } from 'node:crypto';
import { ApiException } from '../../../common/errors/api-exception.js';
import { isValidPassword, PASSWORD_POLICY_MESSAGE } from '../../../common/security/password-policy.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';
import { MailService } from '../../../infrastructure/mail/mail.service.js';
import { renderPasswordResetEmail } from '../../../infrastructure/mail/templates/password-reset-email.js';
import { RedisService } from '../../../infrastructure/redis/redis.service.js';
import { AUDIT_ACTIONS, AUDIT_MODULES } from '../../audit/audit.catalog.js';
import { describePerson } from '../../audit/describe-person.js';
import { AuditService } from '../../audit/services/audit.service.js';
import type { PasswordResetConfirmDto } from '../dtos/password-reset-confirm.dto.js';
import type { PasswordResetRequestDto } from '../dtos/password-reset-request.dto.js';
import { PasswordResetTokenRepository, type PasswordResetTokenRow } from '../repositories/password-reset-token.repository.js';
import { PasswordHasher } from './password-hasher.service.js';
import { SessionService } from './session.service.js';

// HU-58 Esc. 8: como máximo 3 solicitudes por correo en una ventana de 15 minutos.
export const PASSWORD_RESET_MAX_REQUESTS = 3;
export const PASSWORD_RESET_WINDOW_MINUTES = 15;

export const PASSWORD_RESET_MESSAGES = {
  requested: 'Si el correo está registrado, recibirá un enlace',
  invalidEmail: 'Ingrese un correo electrónico válido',
  validLink: 'Enlace válido',
  expired: 'El enlace ha expirado. Solicite uno nuevo',
  invalidLink: 'El enlace no es válido. Solicite uno nuevo',
  missing: 'Complete los campos obligatorios',
  mismatch: 'Las contraseñas no coinciden',
  weakPassword: PASSWORD_POLICY_MESSAGE,
  updated: 'Contraseña actualizada. Inicie sesión con su nueva contraseña',
} as const;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

type ActiveAccount = {
  id: string;
  person: { identification: string; firstName: string; lastName: string; email: string };
};

// Recuperación de contraseña por enlace de un solo uso (HU-58).
@Injectable()
export class RecoverPasswordService {
  private readonly logger = new Logger(RecoverPasswordService.name);
  private readonly ttlMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: PasswordResetTokenRepository,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {
    this.ttlMinutes = config.get<number>('auth.passwordResetTtlMinutes') ?? 30;
  }

  // Siempre responde lo mismo, exista o no la cuenta, para no revelar qué correos están registrados.
  async request(input: PasswordResetRequestDto): Promise<{ message: string }> {
    const email = input.email?.trim().toLowerCase() ?? '';
    if (!email || !isEmail(email)) {
      throw new ApiException(PASSWORD_RESET_MESSAGES.invalidEmail, 400, ['email'], 'PASSWORD_RESET_INVALID_EMAIL');
    }
    const answer = { message: PASSWORD_RESET_MESSAGES.requested };

    if (!(await this.withinRequestLimit(email))) return answer;

    const account = await this.findActiveAccount(email);
    if (!account) return answer;

    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await this.tokens.replaceActive(tx, account.id, now);
      await this.tokens.create(tx, {
        userId: account.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + this.ttlMinutes * 60_000),
      });
      await this.audit.record(tx, {
        actorId: account.id,
        action: AUDIT_ACTIONS.requestPasswordReset,
        module: AUDIT_MODULES.users,
        affectedRecord: describePerson(account.person),
      });
    });

    // El correo sale después de confirmar la transacción y sin esperar al servidor SMTP:
    // así un fallo o una demora del envío no delata que la cuenta existe.
    void this.sendLink(account, token);
    return answer;
  }

  async validate(token: string | undefined): Promise<{ valid: true; message: string }> {
    await this.findUsableLink(this.prisma, token, new Date());
    return { valid: true, message: PASSWORD_RESET_MESSAGES.validLink };
  }

  async confirm(input: PasswordResetConfirmDto): Promise<{ message: string }> {
    const newPassword = input.newPassword ?? '';
    const confirmPassword = input.confirmPassword ?? '';

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const link = await this.findUsableLink(tx, input.token, now);

      if (!newPassword.trim() || !confirmPassword.trim()) {
        throw new ApiException(PASSWORD_RESET_MESSAGES.missing, 400, [], 'PASSWORD_RESET_MISSING_FIELDS');
      }
      if (newPassword !== confirmPassword) {
        throw new ApiException(PASSWORD_RESET_MESSAGES.mismatch, 400, [], 'PASSWORD_RESET_MISMATCH');
      }
      if (!isValidPassword(newPassword)) {
        throw new ApiException(PASSWORD_RESET_MESSAGES.weakPassword, 400, [], 'PASSWORD_RESET_WEAK');
      }

      if (!(await this.tokens.markUsed(tx, link.id, now))) throw invalidLink();

      await tx.user.update({
        where: { id: link.userId },
        data: {
          password: await this.hasher.hash(newPassword),
          mustChangePassword: false,
          failedLoginAttempts: 0,
          isLocked: false,
          lockedAt: null,
        },
      });
      await this.sessions.revokeAllForUser(link.userId, tx);
      await this.audit.record(tx, {
        actorId: link.userId,
        action: AUDIT_ACTIONS.resetPassword,
        module: AUDIT_MODULES.users,
        affectedRecord: describePerson(link.user.person),
      });
    });

    return { message: PASSWORD_RESET_MESSAGES.updated };
  }

  // Vigente mientras la hora actual sea anterior al vencimiento: a los 30:00 exactos ya expiró.
  private async findUsableLink(
    tx: Prisma.TransactionClient,
    token: string | undefined,
    now: Date,
  ): Promise<PasswordResetTokenRow> {
    const value = token?.trim();
    const link = value ? await this.tokens.findByHash(tx, hashToken(value)) : null;
    if (!link || link.usedAt || link.replacedAt || link.user.status !== 'ACTIVE') throw invalidLink();
    if (link.expiresAt.getTime() <= now.getTime()) {
      throw new ApiException(PASSWORD_RESET_MESSAGES.expired, 410, [], 'PASSWORD_RESET_LINK_EXPIRED');
    }
    return link;
  }

  private findActiveAccount(email: string): Promise<ActiveAccount | null> {
    return this.prisma.user.findFirst({
      where: { status: 'ACTIVE', person: { email: { equals: email, mode: 'insensitive' } } },
      select: {
        id: true,
        person: { select: { identification: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  // Cuenta la solicitud en Redis; si Redis no responde, se permite y se deja una advertencia.
  private async withinRequestLimit(email: string): Promise<boolean> {
    const key = `auth:password-reset:${createHash('sha256').update(email).digest('hex')}`;
    try {
      // La ventana empieza con la primera solicitud: NX no reinicia el vencimiento en las siguientes.
      await this.redis.set(key, '0', 'PX', PASSWORD_RESET_WINDOW_MINUTES * 60_000, 'NX');
      const count = await this.redis.incr(key);
      return count <= PASSWORD_RESET_MAX_REQUESTS;
    } catch (error) {
      this.logger.warn(`No se pudo aplicar el límite de recuperación en Redis: ${String(error)}`);
      return true;
    }
  }

  private async sendLink(account: ActiveAccount, token: string): Promise<void> {
    try {
      const baseUrl = (this.config.get<string>('app.url') ?? '').replace(/\/$/, '');
      const { subject, text, html } = renderPasswordResetEmail({
        firstName: account.person.firstName,
        resetUrl: `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`,
        ttlMinutes: this.ttlMinutes,
      });
      await this.mail.send({ to: account.person.email, subject, text, html });
    } catch (error) {
      this.logger.error(`No se pudo enviar el enlace de recuperación del usuario ${account.id}: ${(error as Error).message}`);
    }
  }
}

function invalidLink() {
  return new ApiException(PASSWORD_RESET_MESSAGES.invalidLink, 400, [], 'PASSWORD_RESET_LINK_INVALID');
}
