import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';
import type { Breed, Prisma } from '../../../generated/prisma/client.js';

@Injectable()
export class BreedRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Búsqueda sin distinguir mayúsculas dentro de la especie
  async findByNameInSpecies(speciesId: string, name: string): Promise<Breed | null> {
    return this.prisma.breed.findFirst({
      where: { speciesId, name: { equals: name.trim(), mode: 'insensitive' } },
    });
  }

  async findById(id: string): Promise<Breed | null> {
    return this.prisma.breed.findUnique({ where: { id } });
  }

  // Razas activas de una especie, para el selector del registro de pacientes.
  async findActiveBySpecies(speciesId: string): Promise<Pick<Breed, 'id' | 'name'>[]> {
    return this.prisma.breed.findMany({
      where: { speciesId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  // Toda raza nueva se crea activa
  async create(
    data: { name: string; speciesId: string; description?: string | null },
    tx?: Prisma.TransactionClient,
  ): Promise<Breed> {
    return (tx ?? this.prisma).breed.create({
      data: {
        name: data.name.trim(),
        speciesId: data.speciesId,
        description: data.description?.trim() || null,
        isActive: true,
      },
    });
  }
}
