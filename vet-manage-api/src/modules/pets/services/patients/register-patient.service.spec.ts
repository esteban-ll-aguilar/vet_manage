import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiException } from '../../../../common/errors/api-exception.js';
import { PATIENT_MESSAGES, RegisterPatientService } from './register-patient.service.js';

const ACTOR_ID = 'user-1';
const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const SPECIES_ID = '22222222-2222-4222-8222-222222222222';
const BREED_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_SPECIES_ID = '44444444-4444-4444-8444-444444444444';

const validInput = () => ({
  name: '  Firulais  ',
  speciesId: SPECIES_ID,
  breedId: BREED_ID,
  gender: 'MALE',
  birthDate: '10-05-2024',
  weightKg: 12.5,
  heightCm: '45.3',
  reproductiveStatus: 'STERILIZED',
  color: '  Café  ',
  clientId: CLIENT_ID,
});

function build() {
  const create = vi.fn(async (data: Record<string, unknown>) => ({
    id: 'patient-1',
    code: 'PAC-000001',
    status: 'ACTIVE',
    createdAt: new Date('2026-11-19T12:00:00.000Z'),
    species: { id: SPECIES_ID, name: 'Canino' },
    breed: { id: BREED_ID, name: 'Labrador' },
    ...data,
  }));
  const findClient = vi.fn(async () => ({ id: CLIENT_ID, status: 'ACTIVE' }));
  const findSpecies = vi.fn(async () => ({ id: SPECIES_ID, name: 'Canino', isActive: true }));
  const findBreed = vi.fn(async () => ({ id: BREED_ID, name: 'Labrador', isActive: true, speciesId: SPECIES_ID }));

  const tx = { name: 'tx' };
  const prisma = { $transaction: vi.fn(async (run: (client: unknown) => unknown) => run(tx)) };
  const audit = { record: vi.fn(async () => undefined) };

  const service = new RegisterPatientService(
    { create } as never,
    { findById: findSpecies } as never,
    { findById: findBreed } as never,
    { findById: findClient } as never,
    prisma as never,
    audit as never,
  );
  return { service, create, findClient, findSpecies, findBreed, prisma, audit, tx };
}

async function expectError(promise: Promise<unknown>, message: string, status: number, fields?: string[]) {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(ApiException);
  expect((error as ApiException).message).toBe(message);
  expect((error as ApiException).statusCode).toBe(status);
  if (fields) expect((error as ApiException).errors).toEqual(fields);
}

describe('RegisterPatientService', () => {
  let ctx: ReturnType<typeof build>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 19, 12));
    ctx = build();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Escenario 1: registro exitoso', () => {
    it('guarda los datos normalizados y devuelve el paciente con su código', async () => {
      const patient = await ctx.service.execute(validInput(), ACTOR_ID);

      expect(ctx.create).toHaveBeenCalledWith({
        name: 'Firulais',
        gender: 'MALE',
        birthDate: new Date(Date.UTC(2024, 4, 10)),
        weightKg: 12.5,
        heightCm: 45.3,
        reproductiveStatus: 'STERILIZED',
        color: 'Café',
        clientId: CLIENT_ID,
        speciesId: SPECIES_ID,
        breedId: BREED_ID,
      }, ctx.tx);
      expect(patient).toMatchObject({
        code: 'PAC-000001',
        status: 'ACTIVE',
        birthDate: '10-05-2024',
        weightKg: 12.5,
        heightCm: 45.3,
        species: { name: 'Canino' },
        breed: { name: 'Labrador' },
      });
    });

    it('redondea peso y talla a dos decimales', async () => {
      await ctx.service.execute({ ...validInput(), weightKg: 3.14159, heightCm: 20.005 }, ACTOR_ID);

      expect(ctx.create.mock.calls[0][0]).toMatchObject({ weightKg: 3.14, heightCm: 20.01 });
    });
  });

  describe('Escenario 2: campos obligatorios', () => {
    it('lista todos los campos faltantes', async () => {
      await expectError(
        ctx.service.execute({ clientId: CLIENT_ID, name: '   ', gender: 'MALE' }, ACTOR_ID),
        PATIENT_MESSAGES.missing,
        400,
        ['name', 'speciesId', 'breedId', 'birthDate', 'weightKg', 'heightCm', 'reproductiveStatus'],
      );
      expect(ctx.create).not.toHaveBeenCalled();
    });

    it('rechaza un sexo fuera de las opciones', async () => {
      await expectError(ctx.service.execute({ ...validInput(), gender: 'OTHER' }, ACTOR_ID), PATIENT_MESSAGES.invalidGender, 400, ['gender']);
    });

    it('rechaza un estado reproductivo fuera de las opciones', async () => {
      await expectError(
        ctx.service.execute({ ...validInput(), reproductiveStatus: 'MAYBE' }, ACTOR_ID),
        PATIENT_MESSAGES.invalidReproductiveStatus,
        400,
        ['reproductiveStatus'],
      );
    });

    it('rechaza identificadores sin formato UUID', async () => {
      await expectError(ctx.service.execute({ ...validInput(), breedId: 'abc' }, ACTOR_ID), PATIENT_MESSAGES.invalidId, 400, ['breedId']);
    });
  });

  describe('Escenario 3: color opcional', () => {
    it.each([undefined, '', '   ', null])('guarda el color como null cuando es %j', async (color) => {
      const patient = await ctx.service.execute({ ...validInput(), color }, ACTOR_ID);

      expect(ctx.create.mock.calls[0][0]).toMatchObject({ color: null });
      expect(patient.color).toBeNull();
    });
  });

  describe('Escenario 4: cliente obligatorio', () => {
    it('exige seleccionar un cliente antes que cualquier otro campo', async () => {
      await expectError(ctx.service.execute({}, ACTOR_ID), PATIENT_MESSAGES.clientRequired, 400, ['clientId']);
    });

    it('responde 404 si el cliente no existe', async () => {
      ctx.findClient.mockResolvedValueOnce(null as never);

      await expectError(ctx.service.execute(validInput(), ACTOR_ID), PATIENT_MESSAGES.clientRequired, 404, ['clientId']);
      expect(ctx.create).not.toHaveBeenCalled();
    });
  });

  describe('Escenario 5: cliente no disponible', () => {
    // HU-03: el cliente dado de baja se identifica como desactivado; el inactivo mantiene el mensaje de HU-07.
    it.each([
      ['DEACTIVATED', PATIENT_MESSAGES.clientDeactivated],
      ['INACTIVE', PATIENT_MESSAGES.clientUnavailable],
    ])('responde 409 si el cliente está %s', async (status, message) => {
      ctx.findClient.mockResolvedValueOnce({ id: CLIENT_ID, status });

      await expectError(ctx.service.execute(validInput(), ACTOR_ID), message, 409, ['clientId']);
      expect(ctx.create).not.toHaveBeenCalled();
    });

    it('el mensaje para un cliente de baja es «El cliente está desactivado» (HU-03)', () => {
      expect(PATIENT_MESSAGES.clientDeactivated).toBe('El cliente está desactivado');
    });
  });

  describe('Escenario 6: fecha de nacimiento', () => {
    it.each(['2024-05-10', '31-02-2024', '20-11-2026'])('rechaza %s', async (birthDate) => {
      await expectError(
        ctx.service.execute({ ...validInput(), birthDate }, ACTOR_ID),
        PATIENT_MESSAGES.invalidBirthDate,
        400,
        ['birthDate'],
      );
    });

    it('acepta la fecha de hoy', async () => {
      await expect(ctx.service.execute({ ...validInput(), birthDate: '19-11-2026' }, ACTOR_ID)).resolves.toBeDefined();
    });
  });

  describe('Escenario 7: peso y talla', () => {
    it.each([
      [{ weightKg: 0 }, ['weightKg']],
      [{ heightCm: -3 }, ['heightCm']],
      [{ weightKg: 'abc' }, ['weightKg']],
      [{ weightKg: '1e3', heightCm: true }, ['weightKg', 'heightCm']],
    ])('rechaza %j', async (override, fields) => {
      await expectError(
        ctx.service.execute({ ...validInput(), ...override }, ACTOR_ID),
        PATIENT_MESSAGES.invalidMeasures,
        400,
        fields,
      );
    });

    it('rechaza valores que no caben en la columna', async () => {
      await expectError(
        ctx.service.execute({ ...validInput(), weightKg: 10000 }, ACTOR_ID),
        PATIENT_MESSAGES.measureTooLarge,
        400,
        ['weightKg'],
      );
    });
  });

  describe('especie y raza', () => {
    it('responde 404 si la especie no existe', async () => {
      ctx.findSpecies.mockResolvedValueOnce(null as never);
      await expectError(ctx.service.execute(validInput(), ACTOR_ID), PATIENT_MESSAGES.speciesNotFound, 404);
    });

    it('responde 409 si la especie está inactiva', async () => {
      ctx.findSpecies.mockResolvedValueOnce({ id: SPECIES_ID, name: 'Canino', isActive: false });
      await expectError(ctx.service.execute(validInput(), ACTOR_ID), PATIENT_MESSAGES.speciesInactive, 409);
    });

    it('responde 404 si la raza no existe', async () => {
      ctx.findBreed.mockResolvedValueOnce(null as never);
      await expectError(ctx.service.execute(validInput(), ACTOR_ID), PATIENT_MESSAGES.breedNotFound, 404);
    });

    it('responde 400 si la raza es de otra especie', async () => {
      ctx.findBreed.mockResolvedValueOnce({ id: BREED_ID, name: 'Siamés', isActive: true, speciesId: OTHER_SPECIES_ID });
      await expectError(ctx.service.execute(validInput(), ACTOR_ID), PATIENT_MESSAGES.breedMismatch, 400, ['breedId']);
    });

    it('responde 409 si la raza está inactiva', async () => {
      ctx.findBreed.mockResolvedValueOnce({ id: BREED_ID, name: 'Labrador', isActive: false, speciesId: SPECIES_ID });
      await expectError(ctx.service.execute(validInput(), ACTOR_ID), PATIENT_MESSAGES.breedInactive, 409);
    });
  });

  describe('Escenario 9: código no editable', () => {
    it('ignora el código enviado por el usuario', async () => {
      await ctx.service.execute({ ...validInput(), code: 'PAC-999999' }, ACTOR_ID);

      expect(ctx.create.mock.calls[0][0]).not.toHaveProperty('code');
    });
  });

  describe('auditoría', () => {
    it('registra la acción en la misma transacción con el nombre y el código del paciente', async () => {
      await ctx.service.execute(validInput(), ACTOR_ID);

      expect(ctx.audit.record).toHaveBeenCalledTimes(1);
      expect(ctx.audit.record).toHaveBeenCalledWith(ctx.tx, {
        actorId: ACTOR_ID,
        action: 'Registrar',
        module: 'Pacientes',
        affectedRecord: 'Firulais (PAC-000001)',
      });
    });

    it('no registra nada cuando el registro se rechaza', async () => {
      ctx.findClient.mockResolvedValue(null as never);

      await expect(ctx.service.execute(validInput(), ACTOR_ID)).rejects.toBeInstanceOf(ApiException);

      expect(ctx.create).not.toHaveBeenCalled();
      expect(ctx.audit.record).not.toHaveBeenCalled();
    });

    it('falla el registro si no se puede guardar la auditoría', async () => {
      ctx.audit.record.mockRejectedValue(new Error('fallo de auditoría'));

      await expect(ctx.service.execute(validInput(), ACTOR_ID)).rejects.toThrow('fallo de auditoría');
    });
  });
});
