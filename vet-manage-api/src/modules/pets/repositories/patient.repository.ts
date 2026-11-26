import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';
import type { Gender, Prisma, RecordStatus, ReproductiveStatus } from '../../../generated/prisma/client.js';
import { normalizeSearch } from '../services/patients/normalize-search.js';
import { patientSearchVariants } from '../services/patients/search-variants.js';

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

export type PatientSearchQuery = {
  search?: string;
  page: number;
  pageSize: number;
};

export type PatientSearchRecord = {
  id: string;
  code: string;
  name: string;
  gender: Gender;
  birthDate: Date;
  weightKg: Prisma.Decimal;
  heightCm: Prisma.Decimal;
  reproductiveStatus: ReproductiveStatus;
  color: string | null;
  status: RecordStatus;
  createdAt: Date;
  client: {
    person: { identification: string; firstName: string; lastName: string };
  };
  species: { id: string; name: string };
  breed: { id: string; name: string };
};

const patientWithCatalog = {
  species: { select: { id: true, name: true } },
  breed: { select: { id: true, name: true } },
} as const;

const CODE_PATTERN = /^PAC-\d{4,6}$/i;
const CEDULA_PATTERN = /^\d{5,10}$/;

const patientSearchWhere = (search: string): Prisma.PatientWhereInput => {
  const term = search.trim();
  if (CODE_PATTERN.test(term)) {
    return { code: { equals: term.toUpperCase() } };
  }
  if (CEDULA_PATTERN.test(term)) {
    return { client: { person: { identification: { startsWith: term } } } };
  }

  const normalized = normalizeSearch(term);
  const variants = patientSearchVariants(term);
  const or: Prisma.PatientWhereInput[] = [];

  if (normalized.length >= 2) {
    or.push(...variants.map((variant) => ({
      name: { contains: variant, mode: 'insensitive' as const },
    })));
  }
  if (normalized.length >= 3) {
    or.push(...variants.map((variant) => ({
      client: { person: { firstName: { contains: variant, mode: 'insensitive' as const } } },
    })));
  }

  return { OR: or };
};

@Injectable()
export class PatientRepository {
  constructor(private readonly prisma: PrismaService) {}

  // El código (PAC-NNNNNN) y el estado ACTIVE los asigna la base de datos.
  create(data: NewPatient, tx?: Prisma.TransactionClient) {
    return (tx ?? this.prisma).patient.create({ data, include: patientWithCatalog });
  }

  async searchPatients(query: PatientSearchQuery): Promise<{ patients: PatientSearchRecord[]; total: number }> {
    const search = query.search?.trim();
    const where: Prisma.PatientWhereInput = search ? patientSearchWhere(search) : {};

    const [patients, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        select: {
          id: true,
          code: true,
          name: true,
          gender: true,
          birthDate: true,
          weightKg: true,
          heightCm: true,
          reproductiveStatus: true,
          color: true,
          status: true,
          createdAt: true,
          client: {
            select: { person: { select: { identification: true, firstName: true, lastName: true } } },
          },
          species: { select: { id: true, name: true } },
          breed: { select: { id: true, name: true } },
        },
        orderBy: [{ name: 'asc' }, { code: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.patient.count({ where }),
    ]);

    return { patients, total };
  }
}

export type CreatedPatient = Awaited<ReturnType<PatientRepository['create']>>;
