import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import { minutesToDbTime } from '../../common/time-slots.js';

const BRANCH_SELECT = { select: { id: true, nombre: true } } as const;
const BASE_INCLUDES = { sucursal: BRANCH_SELECT } as const;

export type AvailabilitySlotInput = { startMin: number; endMin: number };

@Injectable()
export class DailyAvailabilityRepository {
  constructor(private readonly prisma: PrismaService) {}

  findBasesForDay(veterinarioId: string, diaSemana: string) {
    return this.prisma.horarioBase.findMany({
      where: { veterinarioId, diaSemana: diaSemana as never, estado: true },
      include: BASE_INCLUDES,
      orderBy: [{ horaInicio: 'asc' }, { sucursalId: 'asc' }],
    });
  }

  findBaseById(id: string) {
    return this.prisma.horarioBase.findFirst({
      where: { id, estado: true },
      include: BASE_INCLUDES,
    });
  }

  findSaturdayShift(veterinarioId: string, fecha: Date) {
    return this.prisma.turnoSabado.findFirst({
      where: { fecha, horarioBase: { veterinarioId, estado: true } },
      include: { horarioBase: { include: BASE_INCLUDES } },
    });
  }

  findSlots(horarioBaseId: string, fecha: Date) {
    return this.prisma.disponibilidadDiaria.findMany({
      where: { horarioBaseId, fecha },
      orderBy: { horaInicio: 'asc' },
    });
  }

  async replaceSlots(horarioBaseId: string, fecha: Date, slots: AvailabilitySlotInput[]) {
    await this.prisma.$transaction(async (tx) => {
      await tx.disponibilidadDiaria.deleteMany({ where: { horarioBaseId, fecha } });
      if (slots.length > 0) {
        await tx.disponibilidadDiaria.createMany({
          data: slots.map((slot) => ({
            horarioBaseId,
            fecha,
            horaInicio: minutesToDbTime(slot.startMin),
            horaFin: minutesToDbTime(slot.endMin),
          })),
        });
      }
    });

    return this.findSlots(horarioBaseId, fecha);
  }

  clearSlots(horarioBaseId: string, fecha: Date) {
    return this.prisma.disponibilidadDiaria.deleteMany({
      where: { horarioBaseId, fecha },
    });
  }

  findActiveAppointments(veterinarioId: string, fecha: Date) {
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
        paciente: { select: { name: true } },
        sala: { select: { nombre: true, sucursal: { select: { nombre: true } } } },
      },
      orderBy: { fechaHora: 'asc' },
    });
  }
}
