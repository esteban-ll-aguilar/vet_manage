import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import { minutesToDbTime } from '../../common/time-slots.js';
import { isWithinWorkingHours, type WorkingHoursQuery } from '../../common/working-hours.js';

type Db = Prisma.TransactionClient;

const appointmentForModification = {
  id: true,
  numero: true,
  estado: true,
  fechaHora: true,
  fechaHoraFin: true,
  veterinarioId: true,
  salaId: true,
  sala: { select: { sucursalId: true } },
  paciente: { select: { clientId: true } },
} satisfies Prisma.CitaSelect;

export type AppointmentForModification = Prisma.CitaGetPayload<{
  select: typeof appointmentForModification;
}>;

export type AppointmentChanges = {
  start: Date;
  end: Date;
  veterinarioId: string;
  salaId: string;
};

@Injectable()
export class AppointmentModificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(operation: (db: Db) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(operation);
  }

  // Mismos bloqueos que el registro de citas, para que dos reservas no tomen el mismo recurso.
  async lock(keys: string[], db: Db): Promise<void> {
    for (const key of [...new Set(keys)].sort()) {
      await db.$queryRaw`SELECT 1 WHERE pg_advisory_xact_lock(hashtextextended(${key}, 0)) IS NULL`;
    }
  }

  findDetail(id: string) {
    return this.prisma.cita.findUnique({
      where: { id },
      select: {
        id: true,
        numero: true,
        estado: true,
        fechaHora: true,
        fechaHoraFin: true,
        importeReserva: true,
        veterinarioId: true,
        salaId: true,
        servicio: { select: { nombre: true } },
        sala: {
          select: {
            nombre: true,
            sucursal: { select: { id: true, nombre: true } },
          },
        },
        paciente: {
          select: {
            name: true,
            client: {
              select: {
                id: true,
                person: { select: { firstName: true, lastName: true, identification: true } },
              },
            },
          },
        },
        veterinario: {
          select: { person: { select: { firstName: true, lastName: true } } },
        },
        pagos: { where: { estado: 'APROBADO' }, select: { id: true }, take: 1 },
      },
    });
  }

  findForModification(id: string, db: Db) {
    return db.cita.findUnique({ where: { id }, select: appointmentForModification });
  }

  async clientHasChangedSchedule(clientId: string, db: Db | PrismaService = this.prisma) {
    const change = await db.reprogramacion.findFirst({
      where: { cita: { paciente: { clientId } } },
      select: { id: true },
    });
    return change !== null;
  }

  findActiveVeterinarian(id: string, now: Date, db: Db) {
    return db.user.findFirst({
      where: {
        id,
        status: 'ACTIVE',
        userRoles: {
          some: {
            role: { name: 'veterinarian', isActive: true },
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
        },
      },
      select: { id: true },
    });
  }

  findActiveRoom(id: string, sucursalId: string, db: Db) {
    return db.sala.findFirst({
      where: { id, sucursalId, tipo: 'CONSULTORIO', estado: true },
      select: { id: true },
    });
  }

  isWithinWorkingHours(query: WorkingHoursQuery, db: Db) {
    return isWithinWorkingHours(db, query);
  }

  findBlock(
    params: { sucursalId: string; veterinarioId: string; date: Date; startMinutes: number; endMinutes: number },
    db: Db,
  ) {
    return db.bloqueoHorario.findFirst({
      where: {
        sucursalId: params.sucursalId,
        fecha: params.date,
        fechaEliminacion: null,
        horaInicio: { lt: minutesToDbTime(params.endMinutes) },
        horaFin: { gt: minutesToDbTime(params.startMinutes) },
        OR: [{ veterinarioId: null }, { veterinarioId: params.veterinarioId }],
      },
      select: { id: true },
    });
  }

  // Citas que ocupan el veterinario o el consultorio en el nuevo horario, sin contar la cita que se modifica.
  findConflicts(appointmentId: string, changes: AppointmentChanges, db: Db) {
    return db.cita.findMany({
      where: {
        id: { not: appointmentId },
        estado: { not: 'CANCELADA' },
        fechaHora: { lt: changes.end },
        fechaHoraFin: { gt: changes.start },
        OR: [{ veterinarioId: changes.veterinarioId }, { salaId: changes.salaId }],
      },
      select: { veterinarioId: true, salaId: true },
    });
  }

  // Solo actualiza si la cita sigue como se leyó; si otra persona la cambió, devuelve 0.
  async update(current: AppointmentForModification, changes: AppointmentChanges, db: Db) {
    const { count } = await db.cita.updateMany({
      where: {
        id: current.id,
        estado: current.estado,
        fechaHora: current.fechaHora,
        veterinarioId: current.veterinarioId,
        salaId: current.salaId,
      },
      data: {
        fechaHora: changes.start,
        fechaHoraFin: changes.end,
        veterinarioId: changes.veterinarioId,
        salaId: changes.salaId,
      },
    });
    return count;
  }

  recordScheduleChange(
    current: AppointmentForModification,
    newStart: Date,
    actorId: string,
    now: Date,
    db: Db,
  ) {
    return Promise.all([
      db.reprogramacion.create({
        data: {
          citaId: current.id,
          fechaHoraAnterior: current.fechaHora,
          fechaHoraNueva: newStart,
          realizadaPorId: actorId,
          fechaRegistro: now,
        },
      }),
      db.notificacionCita.create({
        data: {
          citaId: current.id,
          tipo: 'CAMBIO_HORARIO',
          estado: 'PENDIENTE',
          fechaProgramada: now,
        },
      }),
    ]);
  }

  findUpdated(id: string, db: Db) {
    return db.cita.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        numero: true,
        estado: true,
        fechaHora: true,
        fechaHoraFin: true,
        veterinarioId: true,
        salaId: true,
      },
    });
  }
}
