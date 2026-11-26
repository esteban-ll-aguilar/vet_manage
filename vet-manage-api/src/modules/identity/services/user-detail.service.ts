import { Injectable } from '@nestjs/common';
import { ApiException } from '../../../common/errors/api-exception.js';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';

export const USER_DETAIL_MESSAGES = {
  found: 'Usuario consultado correctamente',
  notFound: 'Usuario no encontrado',
} as const;

export type UserDetail = {
  id: string;
  personId: string;
  identification: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: string;
  deactivatedAt?: Date | null;
  deactivationReason?: string | null;
  roles: { name: string; displayName: string }[];
};

type DetailClient = Pick<PrismaService, 'user'>;

// Roles vigentes: activos y sin vencer, igual que el listado de usuarios.
export const activeRolesWhere = (now: Date) => ({
  role: { isActive: true },
  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
});

// Lee el usuario con sus datos de contacto y roles vigentes; lo usan la consulta y la actualización (HU-53).
export async function findUserDetail(client: DetailClient, id: string): Promise<UserDetail | null> {
  const user = await client.user.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      deactivatedAt: true,
      deactivationReason: true,
      personId: true,
      person: { select: { identification: true, firstName: true, lastName: true, email: true, phone: true } },
      userRoles: {
        where: activeRolesWhere(new Date()),
        select: { role: { select: { name: true, displayName: true } } },
      },
    },
  });
  if (!user) return null;

  return {
    id: user.id,
    personId: user.personId,
    ...user.person,
    status: user.status,
    ...(user.status === 'DEACTIVATED'
      ? {
          deactivatedAt: user.deactivatedAt ?? null,
          deactivationReason: user.deactivationReason ?? null,
        }
      : {}),
    roles: user.userRoles
      .map(({ role }) => role)
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es')),
  };
}

@Injectable()
export class UserDetailService {
  constructor(private readonly prisma: PrismaService) {}

  // Datos de un usuario para su ficha y su formulario de edición (HU-53).
  async get(id: string): Promise<UserDetail> {
    const user = await findUserDetail(this.prisma, id);
    if (!user) throw ApiException.notFound(USER_DETAIL_MESSAGES.notFound);
    return user;
  }
}
