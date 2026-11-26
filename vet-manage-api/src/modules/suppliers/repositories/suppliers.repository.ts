import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';
import type { SupplierListStatus } from '../dtos/list-suppliers-query.dto.js';

export type SupplierRecord = {
  id: string;
  businessName: string;
  ruc: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ListSuppliersInput = {
  page: number;
  pageSize: number;
  search?: string;
  status?: SupplierListStatus;
};

@Injectable()
export class SuppliersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { businessName: string; ruc: string }): Promise<SupplierRecord> {
    return this.prisma.supplier.create({
      data: { ...data, isActive: true },
      select: this.supplierSelection,
    });
  }

  async findSuppliers(query: ListSuppliersInput): Promise<{ suppliers: SupplierRecord[]; total: number }> {
    const search = query.search?.trim();
    const where = {
      ...(query.status ? { isActive: query.status === 'ACTIVE' } : {}),
      ...(search
        ? {
            OR: [
              { businessName: { contains: search, mode: 'insensitive' as const } },
              { ruc: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    } satisfies Prisma.SupplierWhereInput;

    const [suppliers, total] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({
        where,
        select: this.supplierSelection,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return { suppliers, total };
  }

  findById(id: string): Promise<SupplierRecord | null> {
    return this.prisma.supplier.findUnique({ where: { id }, select: this.supplierSelection });
  }

  findByRuc(ruc: string): Promise<{ id: string } | null> {
    return this.prisma.supplier.findUnique({ where: { ruc }, select: { id: true } });
  }

  update(id: string, data: Prisma.SupplierUpdateInput): Promise<SupplierRecord> {
    return this.prisma.supplier.update({ where: { id }, data, select: this.supplierSelection });
  }

  private get supplierSelection() {
    return {
      id: true,
      businessName: true,
      ruc: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    } as const;
  }
}
