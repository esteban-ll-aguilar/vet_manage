import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import { minutesToDbTime, dbTimeToMinutes } from '../../common/time-slots.js';

const SCHEDULE_INCLUDES = {
  veterinario: { select: { person: { select: { firstName: true, lastName: true } } } },
  sucursal: { select: { nombre: true } },
} as const;

const DAY_MAP: Record<string, number> = {
  LUNES: 1,
  MARTES: 2,
  MIERCOLES: 3,
  JUEVES: 4,
  VIERNES: 5,
  SABADO: 6,
};

@Injectable()
export class WorkScheduleRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActive(filters: { veterinarioId?: string; sucursalId?: string }) {
    return this.prisma.horarioBase.findMany({
      where: {
        estado: true,
        ...(filters.veterinarioId ? { veterinarioId: filters.veterinarioId } : {}),
        ...(filters.sucursalId ? { sucursalId: filters.sucursalId } : {}),
      },
      include: SCHEDULE_INCLUDES,
      orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
    });
  }

  findById(id: string) {
    return this.prisma.horarioBase.findFirst({
      where: { id, estado: true },
      include: SCHEDULE_INCLUDES,
    });
  }

  findOverlapping(
    veterinarioId: string,
    diaSemana: string,
    startMin: number,
    endMin: number,
    excludeId?: string,
  ) {
    return this.prisma.horarioBase.findMany({
      where: {
        veterinarioId,
        diaSemana: diaSemana as never,
        estado: true,
        horaInicio: { lt: minutesToDbTime(endMin) },
        horaFin: { gt: minutesToDbTime(startMin) },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  create(data: {
    veterinarioId: string;
    sucursalId: string;
    diaSemana: string;
    horaInicio: Date;
    horaFin: Date;
  }) {
    return this.prisma.horarioBase.create({
      data: data as never,
      include: SCHEDULE_INCLUDES,
    });
  }

  update(
    id: string,
    data: Partial<{
      sucursalId: string;
      diaSemana: string;
      horaInicio: Date;
      horaFin: Date;
    }>,
  ) {
    return this.prisma.horarioBase.update({
      where: { id },
      data: data as never,
      include: SCHEDULE_INCLUDES,
    });
  }

  softDelete(id: string) {
    return this.prisma.horarioBase.update({
      where: { id },
      data: { estado: false },
    });
  }

  findActiveVeterinarians() {
    return this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        userRoles: {
          some: {
            role: { name: 'veterinarian', isActive: true },
          },
        },
      },
      select: {
        id: true,
        person: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ person: { lastName: 'asc' } }, { person: { firstName: 'asc' } }],
    });
  }

  async countConflictingAppointments(
    veterinarioId: string,
    diaSemana: string,
    startMin: number,
    endMin: number,
  ): Promise<number> {
    const targetDay = DAY_MAP[diaSemana];
    if (targetDay === undefined) return 0;

    const citas = await this.prisma.cita.findMany({
      where: {
        veterinarioId,
        estado: { in: ['PROGRAMADA', 'CONFIRMADA'] },
        fechaHora: { gte: new Date() },
      },
      select: { fechaHora: true, fechaHoraFin: true },
    });

    return citas.filter((c) => {
      if (c.fechaHora.getUTCDay() !== targetDay) return false;
      const citaStart = c.fechaHora.getUTCHours() * 60 + c.fechaHora.getUTCMinutes();
      const citaEnd = c.fechaHoraFin.getUTCHours() * 60 + c.fechaHoraFin.getUTCMinutes();
      return citaStart < endMin && citaEnd > startMin;
    }).length;
  }

  async countConflictingAvailability(
    horarioBaseId: string,
    startMin: number,
    endMin: number,
  ): Promise<number> {
    const records = await this.prisma.disponibilidadDiaria.findMany({
      where: { horarioBaseId, fecha: { gte: new Date() } },
      select: { fecha: true, horaInicio: true, horaFin: true },
    });

    return records.filter((r) => {
      const rStart = dbTimeToMinutes(r.horaInicio);
      const rEnd = dbTimeToMinutes(r.horaFin);
      return rStart < startMin || rEnd > endMin;
    }).length;
  }

  async countAvailability(horarioBaseId: string): Promise<number> {
    return this.prisma.disponibilidadDiaria.count({
      where: { horarioBaseId, fecha: { gte: new Date() } },
    });
  }
}
