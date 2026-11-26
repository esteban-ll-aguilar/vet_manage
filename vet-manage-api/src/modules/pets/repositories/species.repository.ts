import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';
import type { Prisma, Species } from '../../../generated/prisma/client.js';

@Injectable()
export class SpeciesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByName(name: string): Promise<Species | null> {
    return this.prisma.species.findFirst({
      where: {
        name: {
          equals: name.trim(),
          mode: 'insensitive',
        },
      },
    });
  }

  async findById(id: string): Promise<Species | null> {
    return this.prisma.species.findUnique({
      where: { id },
    });
  }

  async create(data: { name: string; description?: string | null }, tx?: Prisma.TransactionClient): Promise<Species> {
    return (tx ?? this.prisma).species.create({
      data: {
        name: data.name.trim(),
        description: data.description ? data.description.trim() : null,
        isActive: true,
      },
    });
  }

  async findActive(): Promise<Pick<Species, 'id' | 'name'>[]> {
    return this.prisma.species.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async findAll(): Promise<Species[]> {
    return this.prisma.species.findMany({
      orderBy: { name: 'asc' },
    });
  }

  // Activa o inactiva la especie (HU-15).
  async updateStatus(id: string, isActive: boolean, tx?: Prisma.TransactionClient): Promise<Species> {
    return (tx ?? this.prisma).species.update({ where: { id }, data: { isActive } });
  }

  async update(
    id: string,
    data: { name: string; description: string | null },
    tx?: Prisma.TransactionClient,
  ): Promise<Species> {
    return (tx ?? this.prisma).species.update({
      where: { id },
      data: {
        name: data.name.trim(),
        description: data.description,
      },
    });
  }
}
