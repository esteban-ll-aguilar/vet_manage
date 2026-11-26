import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';

@Injectable()
export class SaturdayShiftRepository {
  constructor(private readonly prisma: PrismaService) {}

  findList(sucursalId?: string, fechaDesde?: Date, fechaHasta?: Date) {
    return this.prisma.turnoSabado.findMany({
      where: {
        ...(sucursalId ? { sucursalId } : {}),
        ...(fechaDesde || fechaHasta ? {
          fecha: {
            ...(fechaDesde ? { gte: fechaDesde } : {}),
            ...(fechaHasta ? { lte: fechaHasta } : {}),
          },
        } : {}),
      },
      include: {
        sucursal: { select: { id: true, nombre: true } },
        horarioBase: {
          select: {
            id: true,
            veterinarioId: true,
            horaInicio: true,
            horaFin: true,
            veterinario: { select: { person: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
      orderBy: [{ fecha: 'asc' }, { sucursalId: 'asc' }],
    });
  }

  findById(id: string) {
    return this.prisma.turnoSabado.findUnique({
      where: { id },
      include: {
        sucursal: { select: { id: true, nombre: true } },
        horarioBase: {
          select: {
            id: true,
            veterinarioId: true,
            horaInicio: true,
            horaFin: true,
            veterinario: { select: { person: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    });
  }

  findSaturdayBase(veterinarioId: string, sucursalId: string) {
    return this.prisma.horarioBase.findFirst({
      where: { veterinarioId, sucursalId, diaSemana: 'SABADO', estado: true },
    });
  }

  findCrossingAssignments(veterinarioId: string, fecha: Date, startMin: number, endMin: number, excludeSucursalId?: string) {
    return this.prisma.turnoSabado.findMany({
      where: {
        fecha,
        ...(excludeSucursalId ? { sucursalId: { not: excludeSucursalId } } : {}),
        horarioBase: { veterinarioId },
      },
      include: { horarioBase: true, sucursal: true },
    }).then((rows) => rows.filter((row) => {
      const rowStart = row.horarioBase.horaInicio.getUTCHours() * 60 + row.horarioBase.horaInicio.getUTCMinutes();
      const rowEnd = row.horarioBase.horaFin.getUTCHours() * 60 + row.horarioBase.horaFin.getUTCMinutes();
      return startMin < rowEnd && rowStart < endMin;
    }));
  }

  findAppointments(veterinarioId: string, fecha: Date) {
    const dayStart = new Date(fecha);
    const dayEnd = new Date(fecha);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    return this.prisma.cita.findMany({
      where: {
        veterinarioId,
        estado: { in: ['PROGRAMADA', 'CONFIRMADA'] },
        fechaHora: { gte: dayStart, lt: dayEnd },
      },
      include: {
        paciente: { include: { client: { include: { person: true } } } },
        sala: { include: { sucursal: true } },
      },
      orderBy: { fechaHora: 'asc' },
    });
  }

  async upsert(sucursalId: string, fecha: Date, horarioBaseId: string, justificacion: string | null) {
    return this.prisma.turnoSabado.upsert({
      where: { sucursalId_fecha: { sucursalId, fecha } },
      update: { horarioBaseId, justificacion },
      create: { sucursalId, fecha, horarioBaseId, justificacion },
      include: {
        sucursal: { select: { id: true, nombre: true } },
        horarioBase: {
          select: {
            veterinarioId: true,
            horaInicio: true,
            horaFin: true,
            veterinario: { select: { person: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    });
  }

  substitute(id: string, horarioBaseId: string, justificacion: string) {
    return this.prisma.turnoSabado.update({
      where: { id },
      data: { horarioBaseId, justificacion },
    });
  }

  findOne(sucursalId: string, fecha: Date) {
    return this.prisma.turnoSabado.findUnique({
      where: { sucursalId_fecha: { sucursalId, fecha } },
    });
  }

  createOnce(sucursalId: string, fecha: Date, horarioBaseId: string) {
    return this.prisma.turnoSabado.create({
      data: { sucursalId, fecha, horarioBaseId, justificacion: null },
    });
  }

  findInRange(veterinarioId: string, fecha: Date) {
    return this.prisma.turnoSabado.findFirst({
      where: { fecha, horarioBase: { veterinarioId } },
    });
  }
}
