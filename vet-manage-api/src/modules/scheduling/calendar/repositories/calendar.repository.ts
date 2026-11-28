import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';

const summary = {
  id: true,
  numero: true,
  fechaHora: true,
  fechaHoraFin: true,
  estado: true,
  paciente: { select: { name: true } },
  veterinario: {
    select: { person: { select: { firstName: true, lastName: true } } },
  },
} as const;

@Injectable()
export class CalendarRepository {
  constructor(private readonly prisma: PrismaService) {}

  branches() {
    return this.prisma.sucursal.findMany({
      select: { id: true, nombre: true, estado: true },
      orderBy: { nombre: 'asc' },
    });
  }

  detail(id: string, sucursalId: string) {
    return this.prisma.cita.findFirst({
      where: { id, sala: { sucursalId } },
      select: {
        ...summary,
        paciente: {
          select: {
            name: true,
            client: {
              select: {
                person: {
                  select: {
                    firstName: true,
                    lastName: true,
                    identification: true,
                  },
                },
              },
            },
          },
        },
        sala: {
          select: {
            nombre: true,
            sucursal: { select: { id: true, nombre: true } },
          },
        },
      },
    });
  }

  snapshot(
    sucursalId: string,
    inicio: Date,
    fin: Date,
    desde: string,
    hasta: string,
  ) {
    const dates = {
      gte: new Date(`${desde}T00:00:00Z`),
      lt: new Date(`${hasta}T00:00:00Z`),
    };
    const overlap = { fechaHora: { lt: fin }, fechaHoraFin: { gt: inicio } };
    return this.prisma.$transaction(
      async (tx) => {
        const branch = await tx.sucursal.findUnique({
          where: { id: sucursalId },
          select: { id: true, nombre: true, estado: true },
        });
        const schedules = await tx.horarioBase.findMany({
          where: {
            sucursalId,
            estado: true,
            veterinario: {
              status: 'ACTIVE',
              userRoles: {
                some: {
                  role: { name: 'veterinarian', isActive: true },
                  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
                },
              },
            },
          },
          include: { disponibilidadesDiarias: { where: { fecha: dates } } },
        });
        const [appointments, occupancy, rooms, blocks, shifts] =
          await Promise.all([
            tx.cita.findMany({
              where: { ...overlap, sala: { sucursalId } },
              select: summary,
              orderBy: [{ fechaHora: 'asc' }, { numero: 'asc' }],
            }),
            tx.cita.findMany({
              where: {
                ...overlap,
                estado: { not: 'CANCELADA' },
                OR: [
                  { sala: { sucursalId } },
                  {
                    veterinarioId: {
                      in: schedules.map((s) => s.veterinarioId),
                    },
                  },
                ],
              },
              select: {
                fechaHora: true,
                fechaHoraFin: true,
                veterinarioId: true,
                salaId: true,
              },
            }),
            tx.sala.findMany({
              where: { sucursalId, estado: true, tipo: 'CONSULTORIO' },
              select: { id: true },
            }),
            tx.bloqueoHorario.findMany({
              where: { sucursalId, fecha: dates, fechaEliminacion: null },
              select: {
                fecha: true,
                horaInicio: true,
                horaFin: true,
                veterinarioId: true,
              },
            }),
            tx.turnoSabado.findMany({
              where: { sucursalId, fecha: dates },
              select: { fecha: true, horarioBaseId: true },
            }),
          ]);
        return {
          branch,
          schedules,
          appointments,
          occupancy,
          rooms,
          blocks,
          shifts,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
