import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';

// Sucursales, salas y servicios activos para los selectores de la agenda.
@Injectable()
export class BranchRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveBranchesWithRooms() {
    return this.prisma.sucursal.findMany({
      where: { estado: true },
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        salas: {
          where: { estado: true },
          orderBy: { nombre: 'asc' },
          select: { id: true, nombre: true, tipo: true },
        },
      },
    });
  }

  findActiveServices() {
    return this.prisma.servicio.findMany({
      where: { estado: true },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, duracionMaximaMin: true },
    });
  }
}
