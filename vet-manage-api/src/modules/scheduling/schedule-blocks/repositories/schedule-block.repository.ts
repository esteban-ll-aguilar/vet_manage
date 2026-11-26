import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';

type Db = Prisma.TransactionClient | PrismaService;

const personName = { select: { person: { select: { firstName: true, lastName: true } } } } as const;

export const SCHEDULE_BLOCK_SELECT = {
  id: true,
  fecha: true,
  horaInicio: true,
  horaFin: true,
  motivo: true,
  creadoEn: true,
  sucursal: { select: { id: true, nombre: true } },
  veterinario: { select: { id: true, person: { select: { firstName: true, lastName: true } } } },
  registradoPor: personName,
} as const;

export type ScheduleBlockRecord = Prisma.BloqueoHorarioGetPayload<{ select: typeof SCHEDULE_BLOCK_SELECT }>;

export type ConflictingAppointment = {
  numero: number;
  fechaHora: Date;
  fechaHoraFin: Date;
  paciente: { name: string };
  sala: { nombre: string };
  veterinario: { person: { firstName: string; lastName: string } };
};

export type NewScheduleBlock = {
  sucursalId: string;
  veterinarioId: string | null;
  fecha: Date;
  horaInicio: Date;
  horaFin: Date;
  motivo: string;
  registradoPorId: string;
};

const activeVeterinarian = (now: Date): Prisma.UserWhereInput => ({
  status: 'ACTIVE',
  userRoles: {
    some: {
      role: { name: 'veterinarian', isActive: true },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  },
});

@Injectable()
export class ScheduleBlockRepository {
  constructor(private readonly prisma: PrismaService) {}

  findBranch(id: string) {
    return this.prisma.sucursal.findUnique({ where: { id }, select: { id: true, nombre: true, estado: true } });
  }

  findActiveVeterinarian(id: string) {
    return this.prisma.user.findFirst({
      where: { id, ...activeVeterinarian(new Date()) },
      select: { id: true },
    });
  }

  listActiveVeterinarians() {
    return this.prisma.user.findMany({
      where: activeVeterinarian(new Date()),
      select: { id: true, person: { select: { firstName: true, lastName: true } } },
      orderBy: [{ person: { lastName: 'asc' } }, { person: { firstName: 'asc' } }],
    });
  }

  // Citas no canceladas de la sucursal que se cruzan con [inicio, fin); con veterinario,
  // solo las de ese veterinario.
  findConflictingAppointments(
    filter: { sucursalId: string; veterinarioId: string | null; inicio: Date; fin: Date },
    db: Db = this.prisma,
  ): Promise<ConflictingAppointment[]> {
    return db.cita.findMany({
      where: {
        estado: { not: 'CANCELADA' },
        fechaHora: { lt: filter.fin },
        fechaHoraFin: { gt: filter.inicio },
        sala: { sucursalId: filter.sucursalId },
        ...(filter.veterinarioId ? { veterinarioId: filter.veterinarioId } : {}),
      },
      select: {
        numero: true,
        fechaHora: true,
        fechaHoraFin: true,
        paciente: { select: { name: true } },
        sala: { select: { nombre: true } },
        veterinario: personName,
      },
      orderBy: { fechaHora: 'asc' },
    });
  }

  create(data: NewScheduleBlock, db: Db = this.prisma): Promise<ScheduleBlockRecord> {
    return db.bloqueoHorario.create({ data, select: SCHEDULE_BLOCK_SELECT });
  }

  // Eliminación lógica de un solo bloqueo. La condición fechaEliminacion = null hace que, si dos
  // personas eliminan el mismo bloqueo a la vez, solo una lo logre. Devuelve cuántos se eliminaron (0 o 1).
  async softDelete(id: string, eliminadoPorId: string, fechaEliminacion: Date): Promise<number> {
    const { count } = await this.prisma.bloqueoHorario.updateMany({
      where: { id, fechaEliminacion: null },
      data: { fechaEliminacion, eliminadoPorId },
    });
    return count;
  }

  // Bloqueos vigentes (no eliminados), del más próximo al más lejano.
  listActive(filter: { sucursalId?: string; desde?: Date; hasta?: Date }): Promise<ScheduleBlockRecord[]> {
    return this.prisma.bloqueoHorario.findMany({
      where: {
        fechaEliminacion: null,
        ...(filter.sucursalId ? { sucursalId: filter.sucursalId } : {}),
        ...(filter.desde || filter.hasta
          ? { fecha: { ...(filter.desde ? { gte: filter.desde } : {}), ...(filter.hasta ? { lte: filter.hasta } : {}) } }
          : {}),
      },
      select: SCHEDULE_BLOCK_SELECT,
      orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
    });
  }
}
