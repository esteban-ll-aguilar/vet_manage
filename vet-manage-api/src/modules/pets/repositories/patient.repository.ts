import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';
import type { Gender, Prisma, ReproductiveStatus } from '../../../generated/prisma/client.js';

export type NewPatient = {
  name: string;
  gender: Gender;
  birthDate: Date;
  weightKg: number;
  heightCm: number;
  reproductiveStatus: ReproductiveStatus;
  color: string | null;
  clientId: string;
  speciesId: string;
  breedId: string;
};

const patientWithCatalog = {
  species: { select: { id: true, name: true } },
  breed: { select: { id: true, name: true } },
} as const;

@Injectable()
export class PatientRepository {
  constructor(private readonly prisma: PrismaService) {}

  // El código (PAC-NNNNNN) y el estado ACTIVE los asigna la base de datos.
  create(data: NewPatient, tx?: Prisma.TransactionClient) {
    return (tx ?? this.prisma).patient.create({ data, include: patientWithCatalog });
  }
}

export type CreatedPatient = Awaited<ReturnType<PatientRepository['create']>>;
