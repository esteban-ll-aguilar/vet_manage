import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { SaturdayShiftRepository } from '../../src/modules/scheduling/saturday-shifts/repositories/saturday-shift.repository.js';
import { SaturdayShiftService } from '../../src/modules/scheduling/saturday-shifts/services/saturday-shift.service.js';

describe('CP-024 pruebas reales de persistencia en vet_manage_hu024', () => {
  let prisma: PrismaService;
  let service: SaturdayShiftService;
  let suffix: string;
  let lojaId: string;
  let vilcabambaId: string;
  let roomId: string;
  let v1Id: string;
  let v2Id: string;
  let v3Id: string;
  let personIds: string[] = [];
  let userIds: string[] = [];
  let branchIds: string[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL ??= 'postgresql://vetmanage:vetmanage_dev_password@localhost:55432/vet_manage_hu024?schema=public';
    process.env.NODE_ENV = 'test';
    prisma = new PrismaService();
    await prisma.$connect();
    service = new SaturdayShiftService(new SaturdayShiftRepository(prisma));
    suffix = randomUUID();

    const loja = await prisma.sucursal.create({ data: { nombre: `Loja ${suffix}` } });
    const vilcabamba = await prisma.sucursal.create({ data: { nombre: `Vilcabamba ${suffix}` } });
    lojaId = loja.id;
    vilcabambaId = vilcabamba.id;
    branchIds = [lojaId, vilcabambaId];
    const room = await prisma.sala.create({ data: { sucursalId: lojaId, nombre: `Consultorio ${suffix}` } });
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

    v1Id = await veterinarian('V1');
    v2Id = await veterinarian('V2');
    v3Id = await veterinarian('V3');

    for (const veterinarianId of [v1Id, v2Id, v3Id]) {
      await prisma.horarioBase.create({
        data: {
          veterinarioId: veterinarianId,
          sucursalId: lojaId,
          diaSemana: 'SABADO',
          horaInicio: new Date('1970-01-01T08:00:00.000Z'),
          horaFin: new Date('1970-01-01T12:00:00.000Z'),
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.turnoSabado.deleteMany({ where: { sucursalId: { in: branchIds } } });
    await prisma.cita.deleteMany({ where: { veterinarioId: { in: userIds } } });
    await prisma.horarioBase.deleteMany({ where: { sucursalId: { in: branchIds } } });
    await prisma.sala.deleteMany({ where: { sucursalId: { in: branchIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
    await prisma.sucursal.deleteMany({ where: { id: { in: branchIds } } });
    await prisma.$disconnect();
  });

  it('CP-024-01 genera V1-V2-V1 y conserva una sola asignación por fecha', async () => {
    const shifts = await service.generate({
      sucursalId: lojaId,
      fechas: ['2026-11-07', '2026-11-14', '2026-11-21'],
      veterinarioIds: [v1Id, v2Id],
    });
    expect(shifts).toHaveLength(3);
    expect(await prisma.turnoSabado.count({ where: { sucursalId: lojaId, fecha: { gte: new Date('2026-11-07T00:00:00.000Z'), lte: new Date('2026-11-21T00:00:00.000Z') } } })).toBe(3);
  });

  it('CP-024-02 y CP-024-03 sustituyen y permiten repetir V1', async () => {
    const target = await prisma.turnoSabado.findUniqueOrThrow({
      where: { sucursalId_fecha: { sucursalId: lojaId, fecha: new Date('2026-11-14T00:00:00.000Z') } },
    });
    await service.substitute(target.id, { veterinarioId: v3Id, justificacion: 'Permiso del veterinario asignado' });
    const byV3 = await prisma.turnoSabado.findUniqueOrThrow({ where: { id: target.id } });
    expect(byV3.justificacion).toBe('Permiso del veterinario asignado');
    expect((await prisma.horarioBase.findUniqueOrThrow({ where: { id: byV3.horarioBaseId } })).veterinarioId).toBe(v3Id);

    await service.substitute(target.id, { veterinarioId: v1Id, justificacion: 'Permiso del veterinario asignado' });
    const byV1 = await prisma.turnoSabado.findUniqueOrThrow({ where: { id: target.id } });
    expect((await prisma.horarioBase.findUniqueOrThrow({ where: { id: byV1.horarioBaseId } })).veterinarioId).toBe(v1Id);
  });

  it('CP-024-04 no guarda turno sin horario base', async () => {
    const before = await prisma.turnoSabado.count({ where: { sucursalId: vilcabambaId } });
    await expect(service.generate({ sucursalId: vilcabambaId, fechas: ['2026-11-28'], veterinarioIds: [v1Id] }))
      .rejects.toThrow('No existe horario base para este sábado');
    expect(await prisma.turnoSabado.count({ where: { sucursalId: vilcabambaId } })).toBe(before);
  });

  it('CP-024-05 rechaza dos veterinarios para sucursal y fecha', async () => {
    const before = await prisma.turnoSabado.count({ where: { sucursalId: lojaId } });
    await expect(service.generate({
      sucursalId: lojaId,
      fechas: [],
      veterinarioIds: [v1Id, v2Id],
      asignaciones: [
        { sucursalId: lojaId, fecha: '2026-12-05', veterinarioId: v1Id },
        { sucursalId: lojaId, fecha: '2026-12-05', veterinarioId: v2Id },
      ],
    })).rejects.toThrow('Debe existir un único veterinario por sucursal y sábado');
    expect(await prisma.turnoSabado.count({ where: { sucursalId: lojaId } })).toBe(before);
  });

  it('CP-024-06 rechaza intervalos cruzados de V1 entre sucursales', async () => {
    await prisma.horarioBase.create({
      data: {
        veterinarioId: v1Id,
        sucursalId: vilcabambaId,
        diaSemana: 'SABADO',
        horaInicio: new Date('1970-01-01T10:00:00.000Z'),
        horaFin: new Date('1970-01-01T13:00:00.000Z'),
      },
    });
    await expect(service.generate({
      sucursalId: lojaId,
      fechas: [],
      veterinarioIds: [v1Id],
      asignaciones: [
        { sucursalId: lojaId, fecha: '2026-12-12', veterinarioId: v1Id },
        { sucursalId: vilcabambaId, fecha: '2026-12-12', veterinarioId: v1Id },
      ],
    })).rejects.toThrow('El veterinario ya tiene otro horario asignado en ese mismo intervalo');
  });

  it('CP-024-07 conserva V2 y no cambia ni cancela la cita', async () => {
    await prisma.turnoSabado.update({
      where: { sucursalId_fecha: { sucursalId: lojaId, fecha: new Date('2026-11-14T00:00:00.000Z') } },
      data: { horarioBaseId: (await prisma.horarioBase.findFirstOrThrow({ where: { veterinarioId: v2Id, sucursalId: lojaId, diaSemana: 'SABADO' } })).id },
    });
    const owner = await prisma.person.create({
      data: {
        identification: String(Math.floor(1_000_000_000 + Math.random() * 8_999_999_999)),
        firstName: 'Cliente',
        lastName: suffix,
        email: `client-${suffix}@example.test`,
      },
    });
    const client = await prisma.client.create({ data: { personId: owner.id } });
    const species = await prisma.species.create({ data: { name: `Especie ${suffix}` } });
    const breed = await prisma.breed.create({ data: { name: `Raza ${suffix}`, speciesId: species.id } });
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
    const appointment = await prisma.cita.create({
      data: {
        numero: undefined,
        estado: 'CONFIRMADA',
        fechaHora: new Date('2026-11-14T09:00:00.000Z'),
        fechaHoraFin: new Date('2026-11-14T09:30:00.000Z'),
        importeReserva: 25,
        pacienteId: patient.id,
        salaId: roomId,
        veterinarioId: v2Id,
        registradaPorId: v1Id,
      },
    });
    const target = await prisma.turnoSabado.findUniqueOrThrow({
      where: { sucursalId_fecha: { sucursalId: lojaId, fecha: new Date('2026-11-14T00:00:00.000Z') } },
    });
    await expect(service.substitute(target.id, { veterinarioId: v3Id, justificacion: 'Permiso del veterinario asignado' }))
      .rejects.toThrow();
    const unchanged = await prisma.cita.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(unchanged.estado).toBe('CONFIRMADA');
    expect(unchanged.veterinarioId).toBe(v2Id);
    const assignment = await prisma.turnoSabado.findUniqueOrThrow({ where: { id: target.id } });
    expect((await prisma.horarioBase.findUniqueOrThrow({ where: { id: assignment.horarioBaseId } })).veterinarioId).toBe(v2Id);

    await prisma.cita.delete({ where: { id: appointment.id } });
    await prisma.patient.delete({ where: { id: patient.id } });
    await prisma.breed.delete({ where: { id: breed.id } });
    await prisma.species.delete({ where: { id: species.id } });
    await prisma.client.delete({ where: { id: client.id } });
    await prisma.person.delete({ where: { id: owner.id } });
  });

  it('concurrencia aplica la restricción única por sucursal y fecha', async () => {
    const results = await Promise.allSettled([
      service.generate({ sucursalId: lojaId, fechas: [], veterinarioIds: [v1Id], asignaciones: [{ sucursalId: lojaId, fecha: '2026-12-19', veterinarioId: v1Id }] }),
      service.generate({ sucursalId: lojaId, fechas: [], veterinarioIds: [v2Id], asignaciones: [{ sucursalId: lojaId, fecha: '2026-12-19', veterinarioId: v2Id }] }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });
});
