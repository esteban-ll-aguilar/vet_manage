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
}
