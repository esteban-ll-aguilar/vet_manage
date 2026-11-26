
import { BadRequestException, Injectable } from '@nestjs/common';
import {
  dbTimeToMinutes,
  isOnSlot,
  overlaps,
  parseTime,
} from '../../common/time-slots.js';
import type { ConsultAvailableResourcesDto } from '../dtos/consult-available-resources.dto.js';
import { ResourcesRepository } from '../repositories/resources.repository.js';

const WEEKDAYS = [
  'DOMINGO',
  'LUNES',
  'MARTES',
  'MIERCOLES',
  'JUEVES',
  'VIERNES',
  'SABADO',
] as const;

type Weekday = (typeof WEEKDAYS)[number];

type ResourceResponse = {
  fecha: string;
  hora: string;
  duracionMin: number;
  veterinarios: {
    id: string;
    nombre: string;
  }[];
  consultorios: {
    id: string;
    nombre: string;
  }[];
  disponible: boolean;
  mensaje: string;
};

@Injectable()
export class ResourcesService {
  constructor(private readonly repo: ResourcesRepository) {}

  async consultAvailableResources(
    dto: ConsultAvailableResourcesDto,
  ): Promise<ResourceResponse> {
    const { fecha, diaSemana, horaInicio, horaFin } =
      this.validateQuery(dto);

    const respuestaVacia = (): ResourceResponse => ({
      fecha: dto.fecha,
      hora: dto.hora,
      duracionMin: dto.duracionMin,
      veterinarios: [],
      consultorios: [],
      disponible: false,
      mensaje: 'Sin disponibilidad en el intervalo seleccionado',
    });

    // 1. No hay disponibilidad los domingos.
    if (diaSemana === 'DOMINGO') {
      return respuestaVacia();
    }

    // 2. Consultar recursos activos y horarios de la sucursal.
    const [veterinarios, consultorios, horarios] =
      await Promise.all([
        this.repo.findActiveVeterinarians(),
        this.repo.findActiveRooms(dto.sucursalId),
        this.repo.findActiveWorkSchedules(
          dto.sucursalId,
          diaSemana,
        ),
      ]);

    // 3. Comprobar que la jornada cubra toda la cita.
    const horariosCompatibles = horarios.filter((horario) => {
      const inicio = dbTimeToMinutes(horario.horaInicio);
      const fin = dbTimeToMinutes(horario.horaFin);

      return horaInicio >= inicio && horaFin <= fin;
    });

    // 4. Respetar el turno asignado para los sábados.
    const turnoSabado =
      diaSemana === 'SABADO'
        ? await this.repo.findSaturdayShift(
            dto.sucursalId,
            fecha,
          )
        : null;

    const horariosValidos =
      diaSemana === 'SABADO'
        ? horariosCompatibles.filter(
            (horario) =>
              horario.id === turnoSabado?.horarioBaseId,
          )
        : horariosCompatibles;

    // 5. Comprobar la disponibilidad diaria.
    const resultados = await Promise.all(
      horariosValidos.map(async (horario) => {
        const franjas =
          await this.repo.findDailyAvailability(
            horario.id,
            fecha,
          );

        if (franjas.length === 0) {
          return horario;
        }

        const intervalos = franjas
          .map((franja) => ({
            inicio: dbTimeToMinutes(franja.horaInicio),
            fin: dbTimeToMinutes(franja.horaFin),
          }))
          .sort((a, b) => a.inicio - b.inicio);

        let cubiertoHasta = horaInicio;

        for (const intervalo of intervalos) {
          if (intervalo.inicio > cubiertoHasta) {
            break;
          }

          cubiertoHasta = Math.max(
            cubiertoHasta,
            intervalo.fin,
          );

          if (cubiertoHasta >= horaFin) {
            return horario;
          }
        }

        return null;
      }),
    );

    const horariosDisponibles = resultados.filter(
      (horario) => horario !== null,
    );

    // 6. Identificar veterinarios candidatos según
    // los horarios disponibles de la sucursal.
    const veterinarioIds = [
      ...new Set(
        horariosDisponibles.map(
          (horario) => horario.veterinarioId,
        ),
      ),
    ];

    // 7. Construir el intervalo solicitado.
    const inicioCita = new Date(
      `${dto.fecha}T${dto.hora}:00.000Z`,
    );

    const finCita = new Date(
      inicioCita.getTime() +
        dto.duracionMin * 60_000,
    );

    // 8. Consultar citas en la sucursal y citas de
    // los veterinarios candidatos en cualquier sucursal.
    const [citas, bloqueos] = await Promise.all([
      this.repo.findAppointmentsInRange(
        dto.sucursalId,
        inicioCita,
        finCita,
        veterinarioIds,
      ),
      this.repo.findActiveScheduleBlocks(
        dto.sucursalId,
        fecha,
      ),
    ]);

    // Los estados distintos de CANCELADA ocupan recursos,
    // de acuerdo con el enum EstadoCita actual.
    const estadosOcupados = new Set([
      'PROGRAMADA',
      'CONFIRMADA',
      'EN_CURSO',
      'FINALIZADA',
      'NO_ASISTIO',
    ]);

    const citasOcupadas = citas.filter((cita) =>
      estadosOcupados.has(cita.estado),
    );

    // 9. Un veterinario no puede atender citas
    // superpuestas, aunque sean de otra sucursal.
    const veterinariosConCita = new Set(
      citasOcupadas.map(
        (cita) => cita.veterinarioId,
      ),
    );

    // 10. Excluir veterinarios con bloqueos superpuestos.
    const veterinariosBloqueados = new Set<string>();

    let bloqueoGeneral = false;

    for (const bloqueo of bloqueos) {
      const inicioBloqueo = dbTimeToMinutes(
        bloqueo.horaInicio,
      );

      const finBloqueo = dbTimeToMinutes(
        bloqueo.horaFin,
      );

      if (
        !overlaps(
          horaInicio,
          horaFin,
          inicioBloqueo,
          finBloqueo,
        )
      ) {
        continue;
      }

      if (bloqueo.veterinarioId === null) {
        bloqueoGeneral = true;
      } else {
        veterinariosBloqueados.add(
          bloqueo.veterinarioId,
        );
      }
    }

    if (bloqueoGeneral) {
      return respuestaVacia();
    }

    // 11. Obtener veterinarios realmente disponibles.
    const veterinariosDisponibles = veterinarios
      .filter((veterinario) =>
        horariosDisponibles.some(
          (horario) =>
            horario.veterinarioId === veterinario.id,
        ),
      )
      .filter(
        (veterinario) =>
          !veterinariosConCita.has(veterinario.id) &&
          !veterinariosBloqueados.has(veterinario.id),
      )
      .map((veterinario) => ({
        id: veterinario.id,
        nombre: [
          veterinario.person.firstName,
          veterinario.person.lastName,
        ]
          .filter(Boolean)
          .join(' '),
      }));

    // 12. Solo las citas de la sucursal consultada
    // pueden ocupar sus consultorios.
    const consultoriosConCita = new Set(
      citasOcupadas
        .filter(
          (cita) =>
            cita.sala.sucursalId === dto.sucursalId,
        )
        .map((cita) => cita.salaId),
    );

    const consultoriosDisponibles = consultorios
      .filter(
        (consultorio) =>
          !consultoriosConCita.has(consultorio.id),
      )
      .map((consultorio) => ({
        id: consultorio.id,
        nombre: consultorio.nombre,
      }));

    // 13. Verificar que existan ambos tipos de recursos.
    const disponible =
      veterinariosDisponibles.length > 0 &&
      consultoriosDisponibles.length > 0;

    return {
      fecha: dto.fecha,
      hora: dto.hora,
      duracionMin: dto.duracionMin,
      veterinarios: veterinariosDisponibles,
      consultorios: consultoriosDisponibles,
      disponible,
      mensaje: disponible
        ? 'Recursos disponibles encontrados'
        : 'Sin disponibilidad en el intervalo seleccionado',
    };
  }

  private validateQuery(
    dto: ConsultAvailableResourcesDto,
  ) {
    // CP-006-04: validar el formato de la fecha.
    if (
      !dto.fecha ||
      !/^\d{4}-\d{2}-\d{2}$/.test(dto.fecha)
    ) {
      throw new BadRequestException(
        'La fecha debe tener formato YYYY-MM-DD',
      );
    }

    const fecha = new Date(
      `${dto.fecha}T00:00:00.000Z`,
    );

    if (
      Number.isNaN(fecha.getTime()) ||
      fecha.toISOString().slice(0, 10) !== dto.fecha
    ) {
      throw new BadRequestException(
        'La fecha no es válida',
      );
    }

    // CP-006-04: impedir consultas de fechas pasadas.
    // Se utiliza la fecha de Ecuador continental.
    const partesHoy = new Intl.DateTimeFormat(
      'en-US',
      {
        timeZone: 'America/Guayaquil',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      },
    ).formatToParts(new Date());

    const obtenerParte = (tipo: string): string =>
      partesHoy.find((parte) => parte.type === tipo)
        ?.value ?? '';

    const fechaActual = [
      obtenerParte('year'),
      obtenerParte('month'),
      obtenerParte('day'),
    ].join('-');

    if (dto.fecha < fechaActual) {
      throw new BadRequestException(
        'No se puede consultar disponibilidad para una fecha pasada. Seleccione una fecha futura.',
      );
    }

    // 14. Validar la hora solicitada.
    const horaInicio = parseTime(dto.hora ?? '');

    if (horaInicio === null) {
      throw new BadRequestException(
        'La hora no es válida',
      );
    }

    if (!isOnSlot(horaInicio)) {
      throw new BadRequestException(
        'La hora debe ser en punto o media hora',
      );
    }

    // CP-006-05: validar duración mínima y múltiplos.
    if (
      !Number.isInteger(dto.duracionMin) ||
      dto.duracionMin < 30 ||
      dto.duracionMin % 30 !== 0
    ) {
      throw new BadRequestException(
        'La duración debe ser un múltiplo de 30 minutos',
      );
    }

    const horaFin =
      horaInicio + dto.duracionMin;

    if (horaFin > 1440) {
      throw new BadRequestException(
        'La duración excede el día seleccionado',
      );
    }

    const diaSemana: Weekday =
      WEEKDAYS[fecha.getUTCDay()];

    return {
      fecha,
      diaSemana,
      horaInicio,
      horaFin,
    };
  }
}
