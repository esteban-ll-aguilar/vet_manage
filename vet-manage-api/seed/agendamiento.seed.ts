type IdRow = { id: string };

type UpsertArgs = {
  where: Record<string, unknown>;
  update: Record<string, unknown>;
  create: Record<string, unknown>;
};

type Delegate = {
  findFirst(args: { where: Record<string, unknown> }): Promise<IdRow | null>;
  update(args: {
    where: { id: string };
    data: Record<string, unknown>;
  }): Promise<IdRow>;
  create(args: { data: Record<string, unknown> }): Promise<IdRow>;
};

type AgendamientoSeedTransaction = {
  user: {
    findMany(args: {
      where: Record<string, unknown>;
      select: { id: true; person: { select: { email: true } } };
    }): Promise<{ id: string; person: { email: string } }[]>;
  };
  sucursal: { upsert(args: UpsertArgs): Promise<IdRow> };
  sala: { upsert(args: UpsertArgs): Promise<IdRow> };
  servicio: { upsert(args: UpsertArgs): Promise<IdRow> };
  tarifa: Delegate;
  horarioBase: Delegate;
  disponibilidadDiaria: Delegate;
  turnoSabado: { upsert(args: UpsertArgs): Promise<IdRow> };
  bloqueoHorario: Delegate;
  person: { upsert(args: UpsertArgs): Promise<IdRow> };
  client: { upsert(args: UpsertArgs): Promise<IdRow> };
  species: {
    findUnique(args: { where: { name: string } }): Promise<IdRow | null>;
  };
  breed: {
    findUnique(args: {
      where: { speciesId_name: { speciesId: string; name: string } };
    }): Promise<IdRow | null>;
  };
  patient: Delegate;
  cita: Delegate;
};

type AgendamientoSeedClient = {
  $transaction<T>(
    callback: (tx: AgendamientoSeedTransaction) => Promise<T>,
  ): Promise<T>;
};

// Las fechas de la demo son fijas (noviembre/diciembre de 2026) para que el
// seed sea idempotente; los registros se actualizan por sus claves naturales.
export const AGENDAMIENTO_DEMO = {
  sucursales: [
    {
      nombre: 'Sucursal Centro',
      salas: [
        { nombre: 'Consultorio 1', tipo: 'CONSULTORIO' },
        { nombre: 'Consultorio 2', tipo: 'CONSULTORIO' },
        { nombre: 'Quirófano 1', tipo: 'QUIROFANO' },
      ],
    },
    {
      nombre: 'Sucursal Norte',
      salas: [
        { nombre: 'Consultorio 1', tipo: 'CONSULTORIO' },
        { nombre: 'Quirófano 1', tipo: 'QUIROFANO' },
      ],
    },
  ],
  servicios: [
    { nombre: 'Consulta general', duracionMaximaMin: 30 },
    { nombre: 'Consulta de especialidad', duracionMaximaMin: 60 },
    { nombre: 'Vacunación', duracionMaximaMin: 30 },
    { nombre: 'Cirugía menor', duracionMaximaMin: 120 },
    { nombre: 'Emergencia', duracionMaximaMin: 60 },
  ],
  tarifas: [
    { servicio: 'Consulta general', sucursal: 'Sucursal Centro', importe: 25 },
    { servicio: 'Consulta general', sucursal: 'Sucursal Norte', importe: 22 },
    {
      servicio: 'Consulta de especialidad',
      sucursal: 'Sucursal Centro',
      importe: 45,
    },
    {
      servicio: 'Consulta de especialidad',
      sucursal: 'Sucursal Norte',
      importe: 40,
    },
    { servicio: 'Vacunación', sucursal: 'Sucursal Centro', importe: 18 },
    { servicio: 'Vacunación', sucursal: 'Sucursal Norte', importe: 16 },
    { servicio: 'Cirugía menor', sucursal: 'Sucursal Centro', importe: 120 },
    { servicio: 'Cirugía menor', sucursal: 'Sucursal Norte', importe: 110 },
    { servicio: 'Emergencia', sucursal: 'Sucursal Centro', importe: 25 },
    { servicio: 'Emergencia', sucursal: 'Sucursal Norte', importe: 25 },
  ],
  horariosBase: [
    {
      veterinario: 'veterinario@vetmanage.local',
      sucursal: 'Sucursal Centro',
      diaSemana: 'LUNES',
      horaInicio: '09:00',
      horaFin: '17:00',
    },
    {
      veterinario: 'veterinario@vetmanage.local',
      sucursal: 'Sucursal Centro',
      diaSemana: 'MARTES',
      horaInicio: '09:00',
      horaFin: '17:00',
    },
    {
      veterinario: 'veterinario@vetmanage.local',
      sucursal: 'Sucursal Centro',
      diaSemana: 'MIERCOLES',
      horaInicio: '09:00',
      horaFin: '17:00',
    },
    {
      veterinario: 'veterinario@vetmanage.local',
      sucursal: 'Sucursal Centro',
      diaSemana: 'JUEVES',
      horaInicio: '09:00',
      horaFin: '17:00',
    },
    {
      veterinario: 'veterinario@vetmanage.local',
      sucursal: 'Sucursal Centro',
      diaSemana: 'VIERNES',
      horaInicio: '09:00',
      horaFin: '17:00',
    },
    {
      veterinario: 'veterinario@vetmanage.local',
      sucursal: 'Sucursal Centro',
      diaSemana: 'SABADO',
      horaInicio: '09:00',
      horaFin: '13:00',
    },
    {
      veterinario: 'veterinario2@vetmanage.local',
      sucursal: 'Sucursal Norte',
      diaSemana: 'LUNES',
      horaInicio: '10:00',
      horaFin: '18:00',
    },
    {
      veterinario: 'veterinario2@vetmanage.local',
      sucursal: 'Sucursal Norte',
      diaSemana: 'MARTES',
      horaInicio: '10:00',
      horaFin: '18:00',
    },
    {
      veterinario: 'veterinario2@vetmanage.local',
      sucursal: 'Sucursal Norte',
      diaSemana: 'MIERCOLES',
      horaInicio: '10:00',
      horaFin: '18:00',
    },
    {
      veterinario: 'veterinario2@vetmanage.local',
      sucursal: 'Sucursal Norte',
      diaSemana: 'JUEVES',
      horaInicio: '10:00',
      horaFin: '18:00',
    },
    {
      veterinario: 'veterinario2@vetmanage.local',
      sucursal: 'Sucursal Norte',
      diaSemana: 'VIERNES',
      horaInicio: '10:00',
      horaFin: '18:00',
    },
    {
      veterinario: 'veterinario2@vetmanage.local',
      sucursal: 'Sucursal Norte',
      diaSemana: 'SABADO',
      horaInicio: '09:00',
      horaFin: '13:00',
    },
    {
      veterinario: 'gerente.veterinario@vetmanage.local',
      sucursal: 'Sucursal Centro',
      diaSemana: 'MARTES',
      horaInicio: '17:00',
      horaFin: '20:00',
    },
    {
      veterinario: 'gerente.veterinario@vetmanage.local',
      sucursal: 'Sucursal Centro',
      diaSemana: 'JUEVES',
      horaInicio: '17:00',
      horaFin: '20:00',
    },
  ],
  disponibilidades: [
    {
      veterinario: 'veterinario@vetmanage.local',
      sucursal: 'Sucursal Centro',
      diaSemana: 'LUNES',
      fecha: '2026-12-07',
      horaInicio: '09:00',
      horaFin: '13:00',
    },
    {
      veterinario: 'veterinario@vetmanage.local',
      sucursal: 'Sucursal Centro',
      diaSemana: 'LUNES',
      fecha: '2026-12-07',
      horaInicio: '14:00',
      horaFin: '17:00',
    },
    {
      veterinario: 'veterinario2@vetmanage.local',
      sucursal: 'Sucursal Norte',
      diaSemana: 'MARTES',
      fecha: '2026-12-08',
      horaInicio: '10:00',
      horaFin: '14:00',
    },
  ],
  turnosSabado: [
    {
      sucursal: 'Sucursal Centro',
      veterinario: 'veterinario@vetmanage.local',
      fecha: '2026-12-12',
    },
    {
      sucursal: 'Sucursal Norte',
      veterinario: 'veterinario2@vetmanage.local',
      fecha: '2026-12-12',
    },
  ],
  bloqueos: [
    {
      sucursal: 'Sucursal Centro',
      veterinario: 'veterinario@vetmanage.local',
      fecha: '2026-12-09',
      horaInicio: '12:00',
      horaFin: '14:00',
      motivo: '[seed] Capacitación interna',
      registradoPor: 'gerente@vetmanage.local',
      eliminadoPor: null,
      fechaEliminacion: null,
    },
    {
      sucursal: 'Sucursal Centro',
      veterinario: null,
      fecha: '2026-12-10',
      horaInicio: '15:00',
      horaFin: '17:00',
      motivo: '[seed] Mantenimiento de consultorio',
      registradoPor: 'gerente@vetmanage.local',
      eliminadoPor: 'gerente@vetmanage.local',
      fechaEliminacion: '2026-12-01T09:00:00.000Z',
    },
  ],
  clientes: [
    {
      email: 'cliente@vetmanage.local',
      identification: '1710000082',
      firstName: 'Sofía',
      lastName: 'Herrera',
      phone: '0991000108',
      address: 'Av. Amazonas 123',
      pacientes: [
        {
          nombre: 'Luna',
          genero: 'FEMALE',
          fechaNacimiento: '2022-03-15',
          pesoKg: 24.5,
          alturaCm: 55,
          estadoReproductivo: 'STERILIZED',
          color: 'Dorado',
          especie: 'Canino',
          raza: 'Labrador Retriever',
        },
        {
          nombre: 'Max',
          genero: 'MALE',
          fechaNacimiento: '2021-07-02',
          pesoKg: 18.2,
          alturaCm: 48,
          estadoReproductivo: 'NOT_STERILIZED',
          color: 'Café',
          especie: 'Canino',
          raza: 'Mestizo',
        },
      ],
    },
    {
      email: 'carlos.mendoza@vetmanage.local',
      identification: '1720000023',
      firstName: 'Carlos',
      lastName: 'Mendoza',
      phone: '0992000202',
      address: 'Calle Bolívar 456',
      pacientes: [
        {
          nombre: 'Milo',
          genero: 'MALE',
          fechaNacimiento: '2023-01-20',
          pesoKg: 4.8,
          alturaCm: 28,
          estadoReproductivo: 'STERILIZED',
          color: 'Crema',
          especie: 'Felino',
          raza: 'Siamés',
        },
      ],
    },
  ],
  citas: [
    {
      motivo: '[seed] Control anual de Luna',
      tipo: 'CONSULTA',
      estado: 'PROGRAMADA',
      importeReserva: 25,
      fechaHora: '2026-12-07T10:00:00.000Z',
      fechaHoraFin: '2026-12-07T10:30:00.000Z',
      tipoCancelacion: null,
      asistenciaDeclarada: null,
      paciente: 'Luna',
      sucursal: 'Sucursal Centro',
      sala: 'Consultorio 1',
      servicio: 'Consulta general',
      veterinario: 'veterinario@vetmanage.local',
      registradaPor: 'recepcion@vetmanage.local',
    },
    {
      motivo: '[seed] Refuerzo de vacunas de Max',
      tipo: 'CONSULTA',
      estado: 'CONFIRMADA',
      importeReserva: 18,
      fechaHora: '2026-12-07T11:00:00.000Z',
      fechaHoraFin: '2026-12-07T11:30:00.000Z',
      tipoCancelacion: null,
      asistenciaDeclarada: null,
      paciente: 'Max',
      sucursal: 'Sucursal Centro',
      sala: 'Consultorio 2',
      servicio: 'Vacunación',
      veterinario: 'veterinario@vetmanage.local',
      registradaPor: 'recepcion@vetmanage.local',
    },
    {
      motivo: '[seed] Evaluación digestiva de Milo',
      tipo: 'CONSULTA',
      estado: 'PROGRAMADA',
      importeReserva: 40,
      fechaHora: '2026-12-08T10:00:00.000Z',
      fechaHoraFin: '2026-12-08T11:00:00.000Z',
      tipoCancelacion: null,
      asistenciaDeclarada: null,
      paciente: 'Milo',
      sucursal: 'Sucursal Norte',
      sala: 'Consultorio 1',
      servicio: 'Consulta de especialidad',
      veterinario: 'veterinario2@vetmanage.local',
      registradaPor: 'recepcion@vetmanage.local',
    },
    {
      motivo: '[seed] Cirugía menor de Luna',
      tipo: 'CIRUGIA',
      estado: 'CONFIRMADA',
      importeReserva: 120,
      fechaHora: '2026-12-09T09:00:00.000Z',
      fechaHoraFin: '2026-12-09T11:00:00.000Z',
      tipoCancelacion: null,
      asistenciaDeclarada: null,
      paciente: 'Luna',
      sucursal: 'Sucursal Centro',
      sala: 'Quirófano 1',
      servicio: 'Cirugía menor',
      veterinario: 'veterinario@vetmanage.local',
      registradaPor: 'recepcion@vetmanage.local',
    },
    {
      motivo: '[seed] Emergencia de Max (finalizada)',
      tipo: 'EMERGENCIA',
      estado: 'FINALIZADA',
      importeReserva: 0,
      fechaHora: '2026-11-12T16:00:00.000Z',
      fechaHoraFin: '2026-11-12T17:00:00.000Z',
      tipoCancelacion: null,
      asistenciaDeclarada: '2026-11-12T16:05:00.000Z',
      paciente: 'Max',
      sucursal: 'Sucursal Centro',
      sala: 'Consultorio 1',
      servicio: 'Emergencia',
      veterinario: 'veterinario@vetmanage.local',
      registradaPor: 'recepcion@vetmanage.local',
    },
    {
      motivo: '[seed] Consulta cancelada de Max',
      tipo: 'CONSULTA',
      estado: 'CANCELADA',
      importeReserva: 22,
      fechaHora: '2026-12-10T11:00:00.000Z',
      fechaHoraFin: '2026-12-10T11:30:00.000Z',
      tipoCancelacion: 'ORDINARIA',
      asistenciaDeclarada: null,
      paciente: 'Max',
      sucursal: 'Sucursal Norte',
      sala: 'Consultorio 1',
      servicio: 'Consulta general',
      veterinario: 'veterinario2@vetmanage.local',
      registradaPor: 'recepcion@vetmanage.local',
    },
  ],
} as const;

const parseTime = (value: string) => {
  const [hour, minute] = value.split(':');
  return new Date(Date.UTC(1970, 0, 1, Number(hour), Number(minute)));
};

const parseDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

function required<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}

async function findOrCreate(
  delegate: Delegate,
  where: Record<string, unknown>,
  data: Record<string, unknown>,
) {
  const existing = await delegate.findFirst({ where });
  if (existing) {
    await delegate.update({ where: { id: existing.id }, data });
    return existing;
  }
  return delegate.create({ data: { ...where, ...data } });
}

export async function seedAgendamiento(prisma: AgendamientoSeedClient) {
  return prisma.$transaction(async (tx) => {
    // Los veterinarios y recepcionistas los crea el seed de identidad.
    const emails = new Set<string>();
    for (const horario of AGENDAMIENTO_DEMO.horariosBase) {
      emails.add(horario.veterinario);
    }
    for (const cita of AGENDAMIENTO_DEMO.citas) {
      emails.add(cita.veterinario);
      emails.add(cita.registradaPor);
    }
    for (const bloqueo of AGENDAMIENTO_DEMO.bloqueos) {
      emails.add(bloqueo.registradoPor);
      if (bloqueo.eliminadoPor) emails.add(bloqueo.eliminadoPor);
    }

    const users = await tx.user.findMany({
      where: { person: { email: { in: [...emails] } } },
      select: { id: true, person: { select: { email: true } } },
    });
    const userIds = new Map(
      users.map((user) => [user.person.email, user.id]),
    );
    const missingUsers = [...emails].filter((email) => !userIds.has(email));
    if (missingUsers.length > 0) {
      throw new Error(
        `Faltan usuarios demo (${missingUsers.join(', ')}). Ejecute primero el seed de identidad.`,
      );
    }

    const sucursalIds = new Map<string, string>();
    const salaIds = new Map<string, string>();
    for (const sucursal of AGENDAMIENTO_DEMO.sucursales) {
      const saved = await tx.sucursal.upsert({
        where: { nombre: sucursal.nombre },
        update: { estado: true },
        create: { nombre: sucursal.nombre, estado: true },
      });
      sucursalIds.set(sucursal.nombre, saved.id);

      for (const sala of sucursal.salas) {
        const savedSala = await tx.sala.upsert({
          where: {
            sucursalId_nombre: { sucursalId: saved.id, nombre: sala.nombre },
          },
          update: { tipo: sala.tipo, estado: true },
          create: {
            sucursalId: saved.id,
            nombre: sala.nombre,
            tipo: sala.tipo,
            estado: true,
          },
        });
        salaIds.set(`${sucursal.nombre}:${sala.nombre}`, savedSala.id);
      }
    }

    const servicioIds = new Map<string, string>();
    for (const servicio of AGENDAMIENTO_DEMO.servicios) {
      const saved = await tx.servicio.upsert({
        where: { nombre: servicio.nombre },
        update: {
          duracionMaximaMin: servicio.duracionMaximaMin,
          estado: true,
        },
        create: {
          nombre: servicio.nombre,
          duracionMaximaMin: servicio.duracionMaximaMin,
          estado: true,
        },
      });
      servicioIds.set(servicio.nombre, saved.id);
    }

    for (const tarifa of AGENDAMIENTO_DEMO.tarifas) {
      const servicioId = required(
        servicioIds.get(tarifa.servicio),
        `No se encontró el servicio ${tarifa.servicio}`,
      );
      const sucursalId = required(
        sucursalIds.get(tarifa.sucursal),
        `No se encontró la sucursal ${tarifa.sucursal}`,
      );
      await findOrCreate(
        tx.tarifa,
        { servicioId, sucursalId, estado: true },
        {
          importe: tarifa.importe,
          fechaVigencia: new Date('2026-11-01T00:00:00.000Z'),
        },
      );
    }

    const horarioIds = new Map<string, string>();
    for (const horario of AGENDAMIENTO_DEMO.horariosBase) {
      const veterinarioId = required(
        userIds.get(horario.veterinario),
        `No se encontró el veterinario ${horario.veterinario}`,
      );
      const sucursalId = required(
        sucursalIds.get(horario.sucursal),
        `No se encontró la sucursal ${horario.sucursal}`,
      );
      const saved = await findOrCreate(
        tx.horarioBase,
        { veterinarioId, sucursalId, diaSemana: horario.diaSemana, estado: true },
        {
          horaInicio: parseTime(horario.horaInicio),
          horaFin: parseTime(horario.horaFin),
        },
      );
      horarioIds.set(
        `${horario.veterinario}:${horario.sucursal}:${horario.diaSemana}`,
        saved.id,
      );
    }

    for (const disponibilidad of AGENDAMIENTO_DEMO.disponibilidades) {
      const horarioBaseId = required(
        horarioIds.get(
          `${disponibilidad.veterinario}:${disponibilidad.sucursal}:${disponibilidad.diaSemana}`,
        ),
        `No se encontró el horario de ${disponibilidad.veterinario}`,
      );
      await findOrCreate(
        tx.disponibilidadDiaria,
        {
          horarioBaseId,
          fecha: parseDate(disponibilidad.fecha),
          horaInicio: parseTime(disponibilidad.horaInicio),
          horaFin: parseTime(disponibilidad.horaFin),
        },
        {
          horaInicio: parseTime(disponibilidad.horaInicio),
          horaFin: parseTime(disponibilidad.horaFin),
        },
      );
    }

    for (const turno of AGENDAMIENTO_DEMO.turnosSabado) {
      const sucursalId = required(
        sucursalIds.get(turno.sucursal),
        `No se encontró la sucursal ${turno.sucursal}`,
      );
      const horarioBaseId = required(
        horarioIds.get(
          `${turno.veterinario}:${turno.sucursal}:SABADO`,
        ),
        `No se encontró el horario de sábado de ${turno.veterinario}`,
      );
      await tx.turnoSabado.upsert({
        where: {
          sucursalId_fecha: { sucursalId, fecha: parseDate(turno.fecha) },
        },
        update: { horarioBaseId, justificacion: null },
        create: {
          sucursalId,
          horarioBaseId,
          fecha: parseDate(turno.fecha),
          justificacion: null,
        },
      });
    }

    for (const bloqueo of AGENDAMIENTO_DEMO.bloqueos) {
      const sucursalId = required(
        sucursalIds.get(bloqueo.sucursal),
        `No se encontró la sucursal ${bloqueo.sucursal}`,
      );
      const registradoPorId = required(
        userIds.get(bloqueo.registradoPor),
        `No se encontró el usuario ${bloqueo.registradoPor}`,
      );
      const veterinarioId = bloqueo.veterinario
        ? required(
            userIds.get(bloqueo.veterinario),
            `No se encontró el veterinario ${bloqueo.veterinario}`,
          )
        : null;
      const eliminadoPorId = bloqueo.eliminadoPor
        ? required(
            userIds.get(bloqueo.eliminadoPor),
            `No se encontró el usuario ${bloqueo.eliminadoPor}`,
          )
        : null;

      await findOrCreate(
        tx.bloqueoHorario,
        { sucursalId, motivo: bloqueo.motivo },
        {
          veterinarioId,
          fecha: parseDate(bloqueo.fecha),
          horaInicio: parseTime(bloqueo.horaInicio),
          horaFin: parseTime(bloqueo.horaFin),
          registradoPorId,
          eliminadoPorId,
          fechaEliminacion: bloqueo.fechaEliminacion
            ? new Date(bloqueo.fechaEliminacion)
            : null,
        },
      );
    }

    // Las especies y razas las crea el seed correspondiente.
    const especies = new Set(
      AGENDAMIENTO_DEMO.clientes.flatMap((cliente) =>
        cliente.pacientes.map((paciente) => paciente.especie),
      ),
    );
    const speciesIds = new Map<string, string>();
    for (const especie of especies) {
      const species = await tx.species.findUnique({ where: { name: especie } });
      if (!species) {
        throw new Error(
          `Falta la especie ${especie}. Ejecute primero el seed de especies.`,
        );
      }
      speciesIds.set(especie, species.id);
    }

    const breedIds = new Map<string, string>();
    for (const cliente of AGENDAMIENTO_DEMO.clientes) {
      for (const paciente of cliente.pacientes) {
        const key = `${paciente.especie}:${paciente.raza}`;
        if (breedIds.has(key)) continue;
        const speciesId = required(
          speciesIds.get(paciente.especie),
          `No se encontró la especie ${paciente.especie}`,
        );
        const breed = await tx.breed.findUnique({
          where: { speciesId_name: { speciesId, name: paciente.raza } },
        });
        if (!breed) {
          throw new Error(
            `Falta la raza ${paciente.raza} (${paciente.especie}). Ejecute primero el seed de razas.`,
          );
        }
        breedIds.set(key, breed.id);
      }
    }

    const pacienteIds = new Map<string, string>();
    for (const cliente of AGENDAMIENTO_DEMO.clientes) {
      const person = await tx.person.upsert({
        where: { email: cliente.email },
        update: {
          identification: cliente.identification,
          firstName: cliente.firstName,
          lastName: cliente.lastName,
          phone: cliente.phone,
          address: cliente.address,
        },
        create: {
          identification: cliente.identification,
          firstName: cliente.firstName,
          lastName: cliente.lastName,
          email: cliente.email,
          phone: cliente.phone,
          address: cliente.address,
        },
      });
      const client = await tx.client.upsert({
        where: { personId: person.id },
        update: { status: 'ACTIVE' },
        create: { personId: person.id, status: 'ACTIVE' },
      });

      for (const paciente of cliente.pacientes) {
        const speciesId = required(
          speciesIds.get(paciente.especie),
          `No se encontró la especie ${paciente.especie}`,
        );
        const breedId = required(
          breedIds.get(`${paciente.especie}:${paciente.raza}`),
          `No se encontró la raza ${paciente.raza}`,
        );
        const saved = await findOrCreate(
          tx.patient,
          { clientId: client.id, name: paciente.nombre },
          {
            gender: paciente.genero,
            birthDate: parseDate(paciente.fechaNacimiento),
            weightKg: paciente.pesoKg,
            heightCm: paciente.alturaCm,
            reproductiveStatus: paciente.estadoReproductivo,
            color: paciente.color,
            status: 'ACTIVE',
            speciesId,
            breedId,
          },
        );
        pacienteIds.set(paciente.nombre, saved.id);
      }
    }

    for (const cita of AGENDAMIENTO_DEMO.citas) {
      const pacienteId = required(
        pacienteIds.get(cita.paciente),
        `No se encontró el paciente ${cita.paciente}`,
      );
      const salaId = required(
        salaIds.get(`${cita.sucursal}:${cita.sala}`),
        `No se encontró la sala ${cita.sala} de ${cita.sucursal}`,
      );
      const servicioId = required(
        servicioIds.get(cita.servicio),
        `No se encontró el servicio ${cita.servicio}`,
      );
      const veterinarioId = required(
        userIds.get(cita.veterinario),
        `No se encontró el veterinario ${cita.veterinario}`,
      );
      const registradaPorId = required(
        userIds.get(cita.registradaPor),
        `No se encontró el usuario ${cita.registradaPor}`,
      );

      await findOrCreate(
        tx.cita,
        { motivo: cita.motivo },
        {
          tipo: cita.tipo,
          fechaHora: new Date(cita.fechaHora),
          fechaHoraFin: new Date(cita.fechaHoraFin),
          estado: cita.estado,
          importeReserva: cita.importeReserva,
          tipoCancelacion: cita.tipoCancelacion,
          asistenciaDeclarada: cita.asistenciaDeclarada
            ? new Date(cita.asistenciaDeclarada)
            : null,
          pacienteId,
          salaId,
          servicioId,
          veterinarioId,
          registradaPorId,
        },
      );
    }

    const salas = AGENDAMIENTO_DEMO.sucursales.reduce(
      (total, sucursal) => total + sucursal.salas.length,
      0,
    );
    const pacientes = AGENDAMIENTO_DEMO.clientes.reduce(
      (total, cliente) => total + cliente.pacientes.length,
      0,
    );

    return {
      sucursales: AGENDAMIENTO_DEMO.sucursales.length,
      salas,
      servicios: AGENDAMIENTO_DEMO.servicios.length,
      tarifas: AGENDAMIENTO_DEMO.tarifas.length,
      horariosBase: AGENDAMIENTO_DEMO.horariosBase.length,
      disponibilidades: AGENDAMIENTO_DEMO.disponibilidades.length,
      turnosSabado: AGENDAMIENTO_DEMO.turnosSabado.length,
      bloqueos: AGENDAMIENTO_DEMO.bloqueos.length,
      clientes: AGENDAMIENTO_DEMO.clientes.length,
      pacientes,
      citas: AGENDAMIENTO_DEMO.citas.length,
    };
  });
}
