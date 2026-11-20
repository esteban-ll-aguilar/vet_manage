import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';
import type { QueryUserStatus } from '../dtos/query-users.dto.js';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'DEACTIVATED';

export type UserQueryFilter = {
  q?: string;
  role?: string;
  status?: QueryUserStatus;
  page: number;
  pageSize: number;
};

export type UserQueryRow = {
  id: string;
  identification: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: { name: string; displayName: string }[];
  status: UserStatus;
};

export type UserQueryResult = {
  items: UserQueryRow[];
  total: number;
  page: number;
  pageSize: number;
};

@Injectable()
export class UserQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  private where(filter: UserQueryFilter): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};
    const q = filter.q?.trim();

    if (q) {
      where.OR = [
        { person: { identification: { equals: q, mode: 'insensitive' } } },
        { person: { firstName: { contains: q, mode: 'insensitive' } } },
        { person: { lastName: { contains: q, mode: 'insensitive' } } },
      ];
    }

    if (filter.role) {
      where.userRoles = { some: { role: { name: filter.role, isActive: true } } };
    }

    if (filter.status) {
      where.status = filter.status;
    }

    return where;
  }

  async findMany(filter: UserQueryFilter): Promise<UserQueryRow[]> {
    const users = await this.prisma.user.findMany({
      where: this.where(filter),
      select: {
        id: true,
        status: true,
        person: { select: { identification: true, firstName: true, lastName: true, email: true } },
        userRoles: { select: { role: { select: { name: true, displayName: true } } } },
      },
      orderBy: [{ person: { lastName: 'asc' } }, { person: { firstName: 'asc' } }],
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
    });

    return users.map((user) => ({
      id: user.id,
      identification: user.person.identification,
      firstName: user.person.firstName,
      lastName: user.person.lastName,
      email: user.person.email,
      roles: user.userRoles.map((assignment) => ({
        name: assignment.role.name,
        displayName: assignment.role.displayName,
      })),
      status: user.status as UserStatus,
    }));
  }

  async count(filter: UserQueryFilter): Promise<number> {
    return this.prisma.user.count({ where: this.where(filter) });
  }
}
