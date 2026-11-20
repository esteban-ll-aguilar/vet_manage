import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { RateRepository } from '../../src/modules/scheduling/rates/repositories/rate.repository.js';
import { RatesService } from '../../src/modules/scheduling/rates/services/rates.service.js';

describe('RatesService with PostgreSQL (HU-025, e2e)', () => {
  let prisma!: PrismaService;
  let rates!: RatesService;
  let branchId: string | undefined;
  let roomId: string | undefined;
  let serviceId: string | undefined;
  let ownerPersonId: string | undefined;
  let clientId: string | undefined;
  let speciesId: string | undefined;
  let breedId: string | undefined;
  let patientId: string | undefined;
  let veterinarianPersonId: string | undefined;
  let veterinarianId: string | undefined;
  let suffix: string;

  beforeAll(async () => {
    process.env.DATABASE_URL ??= 'postgresql://vetmanage:vetmanage_dev_password@localhost:55432/vet_manage?schema=public';
    process.env.NODE_ENV = 'test';
    prisma = new PrismaService();
    await prisma.$connect();
    rates = new RatesService(new RateRepository(prisma));

    suffix = randomUUID();
    const branch = await prisma.sucursal.create({ data: { nombre: `Loja HU025 ${suffix}` } });
    branchId = branch.id;
    const room = await prisma.sala.create({
      data: { sucursalId: branch.id, nombre: `Consultorio HU025 ${suffix}` },
    });
    roomId = room.id;
    const service = await prisma.servicio.create({
      data: { nombre: `Consulta general HU025 ${suffix}`, duracionMaximaMin: 30 },
    });
    serviceId = service.id;

    const ownerPerson = await prisma.person.create({
      data: {
        identification: `${Math.floor(1_000_000_000 + Math.random() * 8_999_999_999)}`,
        firstName: 'Cliente',
        lastName: `HU025 ${suffix}`,
        email: `hu025-owner-${suffix}@example.test`,
      },
    });
    ownerPersonId = ownerPerson.id;
    const client = await prisma.client.create({ data: { personId: ownerPerson.id } });
    clientId = client.id;

    const species = await prisma.species.create({ data: { name: `Especie HU025 ${suffix}` } });
    speciesId = species.id;
    const breed = await prisma.breed.create({
      data: { name: `Raza HU025 ${suffix}`, speciesId: species.id },
    });
    breedId = breed.id;
    const patient = await prisma.patient.create({
      data: {
        name: `Paciente HU025 ${suffix}`,
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

    const veterinarianPerson = await prisma.person.create({
      data: {
        identification: `${Math.floor(1_000_000_000 + Math.random() * 8_999_999_999)}`,
        firstName: 'Veterinario',
        lastName: `HU025 ${suffix}`,
        email: `hu025-vet-${suffix}@example.test`,
      },
    });
    veterinarianPersonId = veterinarianPerson.id;
    const veterinarian = await prisma.user.create({ data: { personId: veterinarianPerson.id } });
    veterinarianId = veterinarian.id;
  });

  afterAll(async () => {
    if (patientId) await prisma.cita.deleteMany({ where: { pacienteId: patientId } });
    if (serviceId) await prisma.tarifa.deleteMany({ where: { servicioId: serviceId } });
    if (patientId) await prisma.patient.deleteMany({ where: { id: patientId } });
    if (breedId) await prisma.breed.deleteMany({ where: { id: breedId } });
    if (speciesId) await prisma.species.deleteMany({ where: { id: speciesId } });
    if (clientId) await prisma.client.deleteMany({ where: { id: clientId } });
    if (ownerPersonId) await prisma.person.deleteMany({ where: { id: ownerPersonId } });
    if (veterinarianId) await prisma.user.deleteMany({ where: { id: veterinarianId } });
    if (veterinarianPersonId) await prisma.person.deleteMany({ where: { id: veterinarianPersonId } });
    if (roomId) await prisma.sala.deleteMany({ where: { id: roomId } });
    if (serviceId) await prisma.servicio.deleteMany({ where: { id: serviceId } });
    if (branchId) await prisma.sucursal.deleteMany({ where: { id: branchId } });
    await prisma.$disconnect();
  });

  async function createAppointment(date: string) {
    const quote = await rates.getReservationQuote(serviceId!, branchId!);
    const appointment = await prisma.cita.create({
      data: {
        fechaHora: new Date(`${date}T10:00:00.000Z`),
        fechaHoraFin: new Date(`${date}T10:30:00.000Z`),
        importeReserva: quote.importeReserva,
        pacienteId: patientId!,
        salaId: roomId!,
        servicioId: quote.servicioId,
        veterinarioId: veterinarianId!,
        registradaPorId: veterinarianId!,
      },
      select: { id: true, importeReserva: true },
    });
    return appointment;
  }

  it('CP-025-01, CP-025-02 y CP-025-03 persiste los precios por cita, conserva el historial y rechaza el servicio inactivo', async () => {
    const initialRate = await rates.save({
      servicioId: serviceId!,
      sucursalId: branchId!,
      importe: 20,
    });
    expect(Number(initialRate.importe)).toBe(20);

    const firstAppointment = await createAppointment('2027-01-10');
    expect(Number(firstAppointment.importeReserva)).toBe(20);

    await rates.update(initialRate.id, { importe: 25 });
    const activeRate = await rates.getActiveRate(serviceId!, branchId!);
    expect(Number(activeRate?.importe)).toBe(25);
    expect(await prisma.tarifa.findUnique({ where: { id: initialRate.id }, select: { estado: true } }))
      .toMatchObject({ estado: false });

    const secondRate = await prisma.tarifa.findFirst({
      where: { servicioId: serviceId!, sucursalId: branchId!, estado: true },
      select: { id: true },
    });
    expect(secondRate).not.toBeNull();

    const secondAppointment = await createAppointment('2027-01-11');
    const appointments = await prisma.cita.findMany({
      where: { id: { in: [firstAppointment.id, secondAppointment.id] } },
      orderBy: { fechaHora: 'asc' },
      select: { id: true, importeReserva: true },
    });
    expect(appointments.map((appointment) => Number(appointment.importeReserva))).toEqual([20, 25]);

    await rates.deactivateService(serviceId!);
    const appointmentsAfterDeactivation = await prisma.cita.findMany({
      where: { id: { in: [firstAppointment.id, secondAppointment.id] } },
      select: { importeReserva: true },
    });
    expect(appointmentsAfterDeactivation).toHaveLength(2);
    expect(appointmentsAfterDeactivation
      .map((appointment) => Number(appointment.importeReserva))
      .sort((left, right) => left - right))
      .toEqual([20, 25]);
    await expect(rates.assertActiveForReservation(serviceId!, branchId!))
      .rejects.toThrow('El servicio no tiene una tarifa activa');
  });
});
