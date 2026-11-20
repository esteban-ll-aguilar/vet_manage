import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';

const rateSelect = {
  id: true,
  servicioId: true,
  sucursalId: true,
  importe: true,
  fechaVigencia: true,
  estado: true,
  servicio: { select: { id: true, nombre: true, estado: true } },
  sucursal: { select: { id: true, nombre: true, estado: true } },
} as const;

@Injectable()
export class RateRepository {
  constructor(private readonly prisma: PrismaService) {}

  findService(id: string) {
    return this.prisma.servicio.findUnique({ where: { id }, select: { id: true, nombre: true, estado: true } });
  }

  findServices() {
    return this.prisma.servicio.findMany({
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, duracionMaximaMin: true, estado: true },
    });
  }

  findBranch(id: string) {
    return this.prisma.sucursal.findUnique({ where: { id }, select: { id: true, nombre: true, estado: true } });
  }

  findMany(servicioId?: string, sucursalId?: string) {
    return this.prisma.tarifa.findMany({
      where: {
        ...(servicioId ? { servicioId } : {}),
        ...(sucursalId ? { sucursalId } : {}),
      },
      orderBy: [{ sucursalId: 'asc' }, { servicioId: 'asc' }, { fechaVigencia: 'desc' }],
      select: rateSelect,
    });
  }

  findActive(servicioId: string, sucursalId: string) {
    return this.prisma.tarifa.findFirst({
      where: { servicioId, sucursalId, estado: true },
      select: rateSelect,
    });
  }

  upsert(servicioId: string, sucursalId: string, importe: number) {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.tarifa.updateMany({
        where: { servicioId, sucursalId, estado: true },
        data: { estado: false },
      });
      return transaction.tarifa.create({
        data: { servicioId, sucursalId, importe },
        select: rateSelect,
      });
    });
  }

  deactivateService(id: string) {
    return this.prisma.servicio.update({
      where: { id },
      data: { estado: false },
      select: { id: true, nombre: true, estado: true },
    });
  }

  activateService(id: string) {
    return this.prisma.servicio.update({
      where: { id },
      data: { estado: true },
      select: { id: true, nombre: true, estado: true },
    });
  }
}
