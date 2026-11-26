import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiException } from '../../../common/errors/api-exception.js';
import type { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';
import { UserDetailService } from './user-detail.service.js';

const storedUser = {
  id: 'u1',
  status: 'ACTIVE',
  personId: 'p1',
  person: {
    identification: '1710034065',
    firstName: 'Carlos',
    lastName: 'Pérez',
    email: 'cperez@correo.com',
    phone: '0991111111',
  },
  userRoles: [
    { role: { name: 'veterinarian', displayName: 'Veterinario' } },
    { role: { name: 'manager', displayName: 'Gerente' } },
  ],
};

describe('UserDetailService', () => {
  const prisma = { user: { findUnique: vi.fn() } };
  const service = new UserDetailService(prisma as unknown as PrismaService);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve los datos de contacto, el estado y los roles vigentes ordenados', async () => {
    prisma.user.findUnique.mockResolvedValue(storedUser);

    await expect(service.get('u1')).resolves.toEqual({
      id: 'u1',
      personId: 'p1',
      identification: '1710034065',
      firstName: 'Carlos',
      lastName: 'Pérez',
      email: 'cperez@correo.com',
      phone: '0991111111',
      status: 'ACTIVE',
      roles: [
        { name: 'manager', displayName: 'Gerente' },
        { name: 'veterinarian', displayName: 'Veterinario' },
      ],
    });
  });

  it('consulta solo los roles activos y sin vencer', async () => {
    prisma.user.findUnique.mockResolvedValue(storedUser);

    await service.get('u1');

    const where = prisma.user.findUnique.mock.calls[0][0].select.userRoles.where;
    expect(where.role).toEqual({ isActive: true });
    expect(where.OR[0]).toEqual({ expiresAt: null });
  });

  it('responde 404 si el usuario no existe', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const error = await service.get('nadie').catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).statusCode).toBe(404);
    expect((error as ApiException).message).toBe('Usuario no encontrado');
  });

  it('incluye fecha y motivo cuando el usuario fue dado de baja', async () => {
    const deactivatedAt = new Date('2026-11-26T10:00:00.000Z');
    prisma.user.findUnique.mockResolvedValue({
      ...storedUser,
      status: 'DEACTIVATED',
      deactivatedAt,
      deactivationReason: 'Renuncia',
    });

    await expect(service.get('u1')).resolves.toMatchObject({
      status: 'DEACTIVATED',
      deactivatedAt,
      deactivationReason: 'Renuncia',
    });
  });
});
