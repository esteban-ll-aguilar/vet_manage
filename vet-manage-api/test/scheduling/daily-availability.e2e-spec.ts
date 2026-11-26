import { randomUUID } from 'node:crypto';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiException } from '../../src/common/errors/api-exception.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { DailyAvailabilityRepository } from '../../src/modules/scheduling/daily-availability/repositories/daily-availability.repository.js';
import { DailyAvailabilityService } from '../../src/modules/scheduling/daily-availability/services/daily-availability.service.js';

// Casos de prueba CP-019-01 a CP-019-07 de la HU-019 contra PostgreSQL real.
// Se ejecuta sobre una base dedicada (vet_manage_hu019) para no tocar desarrollo.
describe('CP-019 disponibilidad diaria propia', () => {
  let prisma: PrismaService;
  let service: DailyAvailabilityService;
  let suffix: string;
  let branchId: string;
  let roomId: string;
  let vetAId: string;
  let vetBId: string;
  let baseMondayAId: string;
  let baseSaturdayAId: string;
  let baseMondayBId: string;
  let patientId: string;
  let ownerId: string;
  let clientId: string;
  let speciesId: string;
  let breedId: string;
  const personIds: string[] = [];
  const userIds: string[] = [];
  const appointmentIds: string[] = [];

  const MONDAY = '2026-11-02';
  const TUESDAY = '2026-11-03';
  const SATURDAY = '2026-11-07';
  const DAY = new Date(`${MONDAY}T00:00:00.000Z`);

  beforeAll(async () => {
    process.env.DATABASE_URL ??= 'postgresql://vetmanage:vetmanage_dev_password@localhost:55432/vet_manage_hu019?schema=public';
    process.env.NODE_ENV = 'test';
    prisma = new PrismaService();
    await prisma.$connect();
    service = new DailyAvailabilityService(new DailyAvailabilityRepository(prisma));
    suffix = randomUUID();

    const branch = await prisma.sucursal.create({ data: { nombre: `Loja ${suffix}` } });
    branchId = branch.id;
    const room = await prisma.sala.create({
      data: { sucursalId: branchId, nombre: `Consultorio ${suffix}` },
    });
    roomId = room.id;

    async function veterinarian(name: string) {
      const person = await prisma.person.create({
        data: {
          identification: String(Math.floor(1_000_000_000 + Math.random() * 8_999_999_999)),
          firstName: name,
          lastName: suffix,
          email: `${name}-${suffix}@example.test`,
        },
      });
      personIds.push(person.id);
      const user = await prisma.user.create({ data: { personId: person.id } });
      userIds.push(user.id);
      return user.id;
    }

    vetAId = await veterinarian('VeterinarioA');
    vetBId = await veterinarian('VeterinarioB');

    const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);
    const mondayA = await prisma.horarioBase.create({
      data: {
        veterinarioId: vetAId,
        sucursalId: branchId,
        diaSemana: 'LUNES',
        horaInicio: time('08:00'),
        horaFin: time('12:00'),
      },
    });
    baseMondayAId = mondayA.id;
    const saturdayA = await prisma.horarioBase.create({
      data: {
        veterinarioId: vetAId,
        sucursalId: branchId,
        diaSemana: 'SABADO',
        horaInicio: time('09:00'),
        horaFin: time('12:00'),
      },
    });
    baseSaturdayAId = saturdayA.id;
    const mondayB = await prisma.horarioBase.create({
      data: {
        veterinarioId: vetBId,
        sucursalId: branchId,
        diaSemana: 'LUNES',
        horaInicio: time('09:00'),
        horaFin: time('13:00'),
      },
    });
    baseMondayBId = mondayB.id;

    const owner = await prisma.person.create({
      data: {
        identification: String(Math.floor(1_000_000_000 + Math.random() * 8_999_999_999)),
        firstName: 'Cliente',
        lastName: suffix,
        email: `client-${suffix}@example.test`,
      },
    });
    ownerId = owner.id;
    personIds.push(owner.id);
    const client = await prisma.client.create({ data: { personId: owner.id } });
    clientId = client.id;
    const species = await prisma.species.create({ data: { name: `Especie ${suffix}` } });
    speciesId = species.id;
    const breed = await prisma.breed.create({ data: { name: `Raza ${suffix}`, speciesId: species.id } });
    breedId = breed.id;
    const patient = await prisma.patient.create({
      data: {
        name: `Paciente ${suffix}`,
        gender: 'FEMALE',
        birthDate: new Date('2020-01-01T00:00:00.000Z'),
        weightKg: 10,
        heightCm: 40,
        reproductiveStatus: 'UNKNOWN',
        clientId: client.id,
        speciesId: species.id,
        breedId: breed.id,
      },
    });
    patientId = patient.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.disponibilidadDiaria.deleteMany({
      where: { horarioBaseId: { in: [baseMondayAId, baseSaturdayAId, baseMondayBId] } },
    });
    await prisma.cita.deleteMany({ where: { id: { in: appointmentIds } } });
    await prisma.patient.deleteMany({ where: { id: patientId } });
    await prisma.breed.deleteMany({ where: { id: breedId } });
    await prisma.species.deleteMany({ where: { id: speciesId } });
    await prisma.client.deleteMany({ where: { id: clientId } });
    await prisma.horarioBase.deleteMany({
      where: { id: { in: [baseMondayAId, baseSaturdayAId, baseMondayBId] } },
    });
    await prisma.sala.deleteMany({ where: { id: roomId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
    await prisma.sucursal.deleteMany({ where: { id: branchId } });
    await prisma.$disconnect();
  });

  async function appointment(start: string, end: string, estado: 'PROGRAMADA' | 'CONFIRMADA' = 'CONFIRMADA') {
    const created = await prisma.cita.create({
      data: {
        estado,
        fechaHora: new Date(`${MONDAY}T${start}:00.000Z`),
        fechaHoraFin: new Date(`${MONDAY}T${end}:00.000Z`),
        importeReserva: 25,
        pacienteId: patientId,
        salaId: roomId,
        veterinarioId: vetAId,
        registradaPorId: vetBId,
      },
    });
    appointmentIds.push(created.id);
    return created;
  }

  it('CP-019-01 reduce la disponibilidad a 08:00-11:00 sin afectar la cita de 09:00', async () => {
    const existing = await appointment('09:00', '09:30');

    await service.saveMine(vetAId, {
      fecha: MONDAY,
      horarioBaseId: baseMondayAId,
      franjas: [{ horaInicio: '08:00', horaFin: '11:00' }],
    });

    // Lo que un flujo de reserva consultaría: solo se ofrecen turnos dentro de la franja.
    const state = await service.getMine(vetAId, MONDAY);
    expect(state.jornadas).toHaveLength(1);
    expect(state.jornadas[0].franjas.map((slot) => `${slot.horaInicio}-${slot.horaFin}`)).toEqual([
      '08:00-11:00',
    ]);
    expect(state.jornadas[0].franjas.every((slot) => slot.horaInicio >= '08:00' && slot.horaFin <= '11:00')).toBe(true);

    // La cita existente no se cancela ni se mueve.
    const unchanged = await prisma.cita.findUniqueOrThrow({ where: { id: existing.id } });
    expect(unchanged.estado).toBe('CONFIRMADA');
    expect(unchanged.fechaHora.toISOString()).toBe(existing.fechaHora.toISOString());
    expect(unchanged.fechaHoraFin.toISOString()).toBe(existing.fechaHoraFin.toISOString());

    // El horario base sigue siendo 08:00-12:00; solo cambió la disponibilidad del día.
    const base = await prisma.horarioBase.findUniqueOrThrow({ where: { id: baseMondayAId } });
    expect(base.horaFin.toISOString()).toBe('1970-01-01T12:00:00.000Z');
  });

  it('CP-019-02 rechaza ampliar la disponibilidad fuera de la jornada (08:00-13:00)', async () => {
    await expect(
      service.saveMine(vetAId, {
        fecha: MONDAY,
        horarioBaseId: baseMondayAId,
        franjas: [{ horaInicio: '08:00', horaFin: '13:00' }],
      }),
    ).rejects.toThrow('La disponibilidad diaria debe estar dentro del horario base');

    // No se guarda el cambio: se conserva la franja anterior.
    const state = await service.getMine(vetAId, MONDAY);
    expect(state.jornadas[0].franjas.map((slot) => `${slot.horaInicio}-${slot.horaFin}`)).toEqual([
      '08:00-11:00',
    ]);
  });

  it('CP-019-03 rechaza terminar a las 11:00 si deja fuera una cita confirmada 11:00-11:30', async () => {
    const blocking = await appointment('11:00', '11:30');

    // Horario anterior: jornada completa autorizada.
    await service.saveMine(vetAId, {
      fecha: MONDAY,
      horarioBaseId: baseMondayAId,
      franjas: [{ horaInicio: '08:00', horaFin: '12:00' }],
    });

    const error = await service
      .saveMine(vetAId, {
        fecha: MONDAY,
        horarioBaseId: baseMondayAId,
        franjas: [{ horaInicio: '08:00', horaFin: '11:00' }],
      })
      .then(() => null)
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ApiException);
    const conflict = error as ApiException;
    expect(conflict.statusCode).toBe(409);
    expect(conflict.message).toBe('El cambio afecta una cita existente');
    expect(conflict.errors.join(' ')).toContain(`Cita #${blocking.numero}`);
    expect(conflict.errors.join(' ')).toContain('11:00–11:30');
    expect(conflict.errors.join(' ')).toContain('CONFIRMADA');

    // Se conserva el horario anterior y la cita sigue igual.
    const state = await service.getMine(vetAId, MONDAY);
    expect(state.jornadas[0].franjas.map((slot) => `${slot.horaInicio}-${slot.horaFin}`)).toEqual([
      '08:00-12:00',
    ]);
    const unchanged = await prisma.cita.findUniqueOrThrow({ where: { id: blocking.id } });
    expect(unchanged.estado).toBe('CONFIRMADA');
  });

  it('CP-019-04 rechaza registrar disponibilidad sin jornada autorizada (03/11/2026)', async () => {
    const getError = await service.getMine(vetAId, TUESDAY).catch((cause: unknown) => cause);
    expect(getError).toBeInstanceOf(BadRequestException);
    expect((getError as Error).message).toBe('No existe horario base para la fecha');

    await expect(
      service.saveMine(vetAId, {
        fecha: TUESDAY,
        horarioBaseId: baseMondayAId,
        franjas: [{ horaInicio: '09:00', horaFin: '10:00' }],
      }),
    ).rejects.toThrow('No existe horario base para la fecha');
  });

  it('CP-019-05 rechaza registrar disponibilidad sin turno de sábado (07/11/2026)', async () => {
    // Tiene horario base de sábado, pero no tiene turno asignado para esa fecha.
    const getError = await service.getMine(vetAId, SATURDAY).catch((cause: unknown) => cause);
    expect(getError).toBeInstanceOf(BadRequestException);
    expect((getError as Error).message).toBe('El veterinario no tiene turno asignado para este sábado');

    await expect(
      service.saveMine(vetAId, {
        fecha: SATURDAY,
        horarioBaseId: baseSaturdayAId,
        franjas: [{ horaInicio: '09:00', horaFin: '10:00' }],
      }),
    ).rejects.toThrow('El veterinario no tiene turno asignado para este sábado');

    expect(
      await prisma.disponibilidadDiaria.count({
        where: { horarioBaseId: baseSaturdayAId, fecha: new Date(`${SATURDAY}T00:00:00.000Z`) },
      }),
    ).toBe(0);
  });

  it('CP-019-06 rechaza una franja con fin anterior al inicio (12:00-08:00)', async () => {
    await expect(
      service.saveMine(vetAId, {
        fecha: MONDAY,
        horarioBaseId: baseMondayAId,
        franjas: [{ horaInicio: '12:00', horaFin: '08:00' }],
      }),
    ).rejects.toThrow('La hora de fin debe ser posterior a la hora de inicio');

    const state = await service.getMine(vetAId, MONDAY);
    expect(state.jornadas[0].franjas.map((slot) => `${slot.horaInicio}-${slot.horaFin}`)).toEqual([
      '08:00-12:00',
    ]);
  });

  it('CP-019-07 impide modificar la disponibilidad de otro veterinario', async () => {
    const error = await service
      .saveMine(vetAId, {
        fecha: MONDAY,
        horarioBaseId: baseMondayBId,
        franjas: [{ horaInicio: '09:00', horaFin: '10:00' }],
      })
      .then(() => null)
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as Error).message).toBe('No tiene permisos para esta acción');

    // El horario del otro veterinario no cambia.
    expect(
      await prisma.disponibilidadDiaria.count({
        where: { horarioBaseId: baseMondayBId, fecha: DAY },
      }),
    ).toBe(0);
    const baseB = await prisma.horarioBase.findUniqueOrThrow({ where: { id: baseMondayBId } });
    expect(baseB.veterinarioId).toBe(vetBId);
  });
});
