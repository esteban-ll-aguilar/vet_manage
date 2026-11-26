import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';
import type { Breed, Prisma } from '../../../generated/prisma/client.js';

export type BreedWithSpecies = Breed & {
  species: { id: string; name: string };
};

@Injectable()
export class BreedRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<BreedWithSpecies[]> {
    return this.prisma.breed.findMany({
      include: { species: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
  }

  // Listado con filtros combinables (HU-20): nombre sin mayúsculas ni tildes y especie.
  // Incluye razas activas e inactivas.
  async findByFilters(filters: { nameVariants?: string[]; speciesId?: string }): Promise<BreedWithSpecies[]> {
    const where: Prisma.BreedWhereInput = {
      ...(filters.speciesId ? { speciesId: filters.speciesId } : {}),
      ...(filters.nameVariants?.length
        ? { OR: filters.nameVariants.map((variant) => ({ name: { contains: variant, mode: 'insensitive' as const } })) }
        : {}),
    };
    return this.prisma.breed.findMany({
      where,
      include: { species: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
  }

  // Búsqueda sin distinguir mayúsculas dentro de la especie
  async findByNameInSpecies(speciesId: string, name: string): Promise<Breed | null> {
    return this.prisma.breed.findFirst({
      where: { speciesId, name: { equals: name.trim(), mode: 'insensitive' } },
    });
  }

  async findById(id: string): Promise<Breed | null> {
    return this.prisma.breed.findUnique({ where: { id } });
  }

  async findByIdWithSpecies(id: string): Promise<BreedWithSpecies | null> {
    return this.prisma.breed.findUnique({
      where: { id },
      include: { species: { select: { id: true, name: true } } },
    });
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

  async update(
    id: string,
    data: { name: string; speciesId: string; description: string | null },
    tx?: Prisma.TransactionClient,
  ): Promise<BreedWithSpecies> {
    return (tx ?? this.prisma).breed.update({
      where: { id },
      data: {
        name: data.name.trim(),
        speciesId: data.speciesId,
        description: data.description,
      },
      include: { species: { select: { id: true, name: true } } },
    });
  }
}
