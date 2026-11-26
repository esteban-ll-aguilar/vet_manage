

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';

@Injectable()
export class ResourcesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveVeterinarians() {
    return this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        userRoles: {
          some: {
            role: {
              name: 'veterinarian',
              isActive: true,
            },
          },
        },
      },
      select: {
        id: true,
        person: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [
        { person: { lastName: 'asc' } },
        { person: { firstName: 'asc' } },
      ],
    });
  }

  findActiveRooms(sucursalId: string) {
    return this.prisma.sala.findMany({
      where: {
        sucursalId,
        tipo: 'CONSULTORIO',
        estado: true,
      },
      select: {
        id: true,
        nombre: true,
      },
      orderBy: {
        nombre: 'asc',
      },
    });
  }

  findActiveWorkSchedules(
    sucursalId: string,
    diaSemana: string,
  ) {
    return this.prisma.horarioBase.findMany({
      where: {
        sucursalId,
        diaSemana: diaSemana as never,
        estado: true,
      },
      orderBy: [
        { horaInicio: 'asc' },
        { veterinarioId: 'asc' },
      ],
    });
  }

  findDailyAvailability(
    horarioBaseId: string,
    fecha: Date,
  ) {
    return this.prisma.disponibilidadDiaria.findMany({
      where: {
        horarioBaseId,
        fecha,
      },
      orderBy: {
        horaInicio: 'asc',
      },
    });
  }

  findSaturdayShift(
    sucursalId: string,
    fecha: Date,
  ) {
    return this.prisma.turnoSabado.findUnique({
      where: {
        sucursalId_fecha: {
          sucursalId,
          fecha,
        },
      },
    });
  }

  findAppointmentsInRange(
    sucursalId: string,
    inicio: Date,
    fin: Date,
    veterinarioIds: string[],
  ) {
    return this.prisma.cita.findMany({
      where: {
        fechaHora: {
          lt: fin,
        },
        fechaHoraFin: {
          gt: inicio,
        },
        OR: [
          {
            sala: {
              sucursalId,
            },
          },
          {
            veterinarioId: {
              in: veterinarioIds,
            },
          },
        ],
      },
      select: {
        id: true,
        veterinarioId: true,
        salaId: true,
        estado: true,
        fechaHora: true,
        fechaHoraFin: true,
        sala: {
          select: {
            sucursalId: true,
          },
        },
      },
    });
  }

  findActiveScheduleBlocks(
    sucursalId: string,
    fecha: Date,
  ) {
    return this.prisma.bloqueoHorario.findMany({
      where: {
        sucursalId,
        fecha,
        fechaEliminacion: null,
      },
      select: {
        id: true,
        veterinarioId: true,
        horaInicio: true,
        horaFin: true,
      },
      orderBy: {
        horaInicio: 'asc',
      },
    });
  }
}
