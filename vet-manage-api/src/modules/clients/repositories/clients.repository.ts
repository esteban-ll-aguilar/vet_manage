import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';
import type { ClientStatus } from '../dtos/client-response.dto.js';
import type { ListClientsQueryDto } from '../dtos/list-clients-query.dto.js';

export type ClientWithPerson = {
  id: string;
  personId: string;
  status: ClientStatus;
  createdAt: Date;
  deactivatedAt: Date | null;
  deactivationReason: string | null;
  deactivatedBy: { person: { firstName: string; lastName: string } } | null;
  person: {
    identification: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    address: string | null;
    user: {
      userRoles: { role: { name: string; displayName: string } }[];
    } | null;
  };
};

export type ClientSearchResult = { clients: ClientWithPerson[]; total: number };

export type ClientPetRecord = {
  id: string;
  code: string;
  name: string;
  status: ClientStatus;
  species: { name: string };
  breed: { name: string };
};

const CLIENT_ROLE_NAME = 'client';
export const MAX_SEARCH_VARIANTS = 64;

export const ACCENT_EQUIVALENTS: Record<string, string[]> = {
  a: ['a', 'á'],
  e: ['e', 'é'],
  i: ['i', 'í'],
  o: ['o', 'ó'],
  u: ['u', 'ú', 'ü'],
  n: ['n', 'ñ'],
};

const searchVariants = (search: string): string[] => {
  const normalized = search.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  let variants = [''];

  for (const char of normalized) {
    const options = ACCENT_EQUIVALENTS[char] ?? [char];
    const next: string[] = [];
    for (const variant of variants) {
      for (const option of options) {
        if (next.length >= MAX_SEARCH_VARIANTS) break;
        next.push(`${variant}${option}`);
      }
      if (next.length >= MAX_SEARCH_VARIANTS) break;
    }
    variants = next;
  }

  return variants;
};

const personSearchWhere = (search: string): Prisma.PersonWhereInput => {
  if (/^\d{10}$/.test(search)) {
    return { OR: [{ identification: { equals: search } }] };
  }

  return {
    OR: searchVariants(search).flatMap((variant) => [
      { firstName: { contains: variant, mode: 'insensitive' as const } },
      { lastName: { contains: variant, mode: 'insensitive' as const } },
    ]),
  };
};

@Injectable()
export class ClientsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findClients(query: ListClientsQueryDto): Promise<ClientSearchResult> {
    const now = new Date();
    const search = query.search?.trim();
    const activeClientRole = {
      role: { name: CLIENT_ROLE_NAME, isActive: true },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    } satisfies Prisma.UserRoleWhereInput;

    const person: Prisma.PersonWhereInput = {
      user: { userRoles: { some: activeClientRole } },
      ...(search ? personSearchWhere(search) : {}),
    };

    const where = {
      ...(query.status ? { status: query.status } : {}),
      person,
    } satisfies Prisma.ClientWhereInput;

    const [clients, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        include: {
          deactivatedBy: { select: { person: { select: { firstName: true, lastName: true } } } },
          person: {
            include: {
              user: {
                include: {
                  userRoles: {
                    where: {
                      role: { isActive: true },
                      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
                    },
                    select: { role: { select: { name: true, displayName: true } } },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ person: { lastName: 'asc' } }, { person: { firstName: 'asc' } }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.client.count({ where }),
    ]);

    return { clients, total };
  }

  // Datos mínimos para que otros dominios validen al cliente (HU-07).
  findById(id: string): Promise<{ id: string; status: ClientStatus } | null> {
    return this.prisma.client.findUnique({ where: { id }, select: { id: true, status: true } });
  }

  async findPetsByClientId(clientId: string): Promise<ClientPetRecord[] | null> {
    const client = await this.findById(clientId);
    if (!client) return null;

    return this.prisma.patient.findMany({
      where: { clientId },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        species: { select: { name: true } },
        breed: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });
  }
}
