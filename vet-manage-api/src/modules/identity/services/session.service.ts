import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';

export type SessionMeta = { ipAddress?: string; userAgent?: string };
export type IssuedSession = { refreshToken: string; expiresAt: Date };

const UNIT_MS = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

// Convierte una duración como 15m, 12h o 7d a milisegundos.
export function durationToMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) throw new Error(`Duración inválida: ${value}`);
  return Number(match[1]) * UNIT_MS[match[2] as keyof typeof UNIT_MS];
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

// Sesiones de larga duración identificadas por un refresh token que rota en cada uso.
@Injectable()
export class SessionService {
  private readonly ttlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.ttlMs = durationToMs(config.getOrThrow<string>('auth.sessionExpiresIn'));
  }

  get maxAgeMs() {
    return this.ttlMs;
  }

  async create(userId: string, meta: SessionMeta = {}): Promise<IssuedSession> {
    const refreshToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.ttlMs);
    await this.prisma.userSession.create({
      data: {
        userId,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt,
        ipAddress: meta.ipAddress?.slice(0, 45),
        userAgent: meta.userAgent,
      },
    });
    return { refreshToken, expiresAt };
  }

  // Revoca el token recibido y emite otro; null si no existe, venció, ya se usó o la cuenta no está activa.
  async rotate(refreshToken: string, meta: SessionMeta = {}): Promise<(IssuedSession & { userId: string }) | null> {
    const now = new Date();
    const session = await this.prisma.userSession.findUnique({
      where: { refreshTokenHash: hashToken(refreshToken) },
      select: { id: true, userId: true, expiresAt: true, revokedAt: true, user: { select: { status: true } } },
    });
    if (!session?.userId || session.revokedAt || session.expiresAt <= now) return null;

    const { count } = await this.prisma.userSession.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: now },
    });
    if (count === 0 || session.user?.status !== 'ACTIVE') return null;

    return { userId: session.userId, ...(await this.create(session.userId, meta)) };
  }

  // Cierra todas las sesiones abiertas de la cuenta (HU-58: al restablecer la contraseña).
  async revokeAllForUser(userId: string, tx: Prisma.TransactionClient = this.prisma) {
    await tx.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revoke(refreshToken: string) {
    await this.prisma.userSession.updateMany({
      where: { refreshTokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
