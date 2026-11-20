import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import configuration from '../../src/config/configuration.js';
import { ROLES } from '../../src/config/roles.catalog.js';
import { GlobalExceptionFilter } from '../../src/common/errors/global-exception.filter.js';
import { PetsModule } from '../../src/modules/pets/pets.module.js';
import { BreedRepository } from '../../src/modules/pets/repositories/breed.repository.js';
import { PatientRepository } from '../../src/modules/pets/repositories/patient.repository.js';
import { SpeciesRepository } from '../../src/modules/pets/repositories/species.repository.js';
import { ClientsRepository } from '../../src/modules/clients/repositories/clients.repository.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { AuditService } from '../../src/modules/audit/services/audit.service.js';
import { AccessService } from '../../src/modules/identity/services/access.service.js';
import { TokenService } from '../../src/modules/identity/services/token.service.js';

const DOG = '123e4567-e89b-12d3-a456-426614174000';
const CAT = '123e4567-e89b-12d3-a456-426614174001';
const LABRADOR = '223e4567-e89b-12d3-a456-426614174000';
const POODLE = '223e4567-e89b-12d3-a456-426614174001';
const OLD_BREED = '223e4567-e89b-12d3-a456-426614174002';
const SIAMESE = '223e4567-e89b-12d3-a456-426614174003';
const ACTIVE_CLIENT = '323e4567-e89b-12d3-a456-426614174000';
const DEACTIVATED_CLIENT = '323e4567-e89b-12d3-a456-426614174001';
const MISSING = '923e4567-e89b-12d3-a456-426614174999';

const permissionsOf = (role: string) => new Set(ROLES.find((r) => r.name === role)?.permissions ?? []);

describe('PatientsController (e2e)', () => {
  let app: INestApplication;
  let permissions: Set<string>;
  let patients: Array<Record<string, unknown>>;

  const speciesDb = [
    { id: DOG, name: 'Canino', isActive: true },
    { id: CAT, name: 'Felino', isActive: true },
  ];
  const breedsDb = [
    { id: LABRADOR, name: 'Labrador', speciesId: DOG, isActive: true },
    { id: POODLE, name: 'Poodle', speciesId: DOG, isActive: true },
    { id: OLD_BREED, name: 'Antigua', speciesId: DOG, isActive: false },
    { id: SIAMESE, name: 'Siamés', speciesId: CAT, isActive: true },
  ];
  const clientsDb = [
    { id: ACTIVE_CLIENT, status: 'ACTIVE' },
    { id: DEACTIVATED_CLIENT, status: 'DEACTIVATED' },
  ];

  const tokens = { verify: vi.fn(async () => 'user-1') };
  const audit = { record: vi.fn(async () => undefined) };
  const prisma = { $transaction: vi.fn(async (run: (client: unknown) => unknown) => run({})) };
  const access = {
    findActiveUser: vi.fn(async () => ({ id: 'user-1' })),
    getPermissionKeys: vi.fn(async () => permissions),
  };
  const speciesRepo = { findById: vi.fn(async (id: string) => speciesDb.find((s) => s.id === id) ?? null) };
  const breedRepo = {
    findById: vi.fn(async (id: string) => breedsDb.find((b) => b.id === id) ?? null),
    findActiveBySpecies: vi.fn(async (speciesId: string) =>
      breedsDb
        .filter((b) => b.speciesId === speciesId && b.isActive)
        .map(({ id, name }) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name))),
  };
  const clientsRepo = { findById: vi.fn(async (id: string) => clientsDb.find((c) => c.id === id) ?? null) };
  // Simula la secuencia pet_code_seq de la base de datos.
  const petRepo = {
    create: vi.fn(async (data: Record<string, unknown>) => {
      const created = {
        id: `patient-${patients.length + 1}`,
        code: `PAC-${String(patients.length + 1).padStart(6, '0')}`,
        status: 'ACTIVE',
        createdAt: new Date('2026-11-19T12:00:00.000Z'),
        species: speciesDb.find((s) => s.id === data.speciesId),
        breed: breedsDb.find((b) => b.id === data.breedId),
        ...data,
      };
      patients.push(created);
      return created;
    }),
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/vet_manage';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'secret-for-testing-only-at-least-32-chars-long';
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, load: [configuration] }), PetsModule],
    })
      .overrideProvider(PrismaService).useValue(prisma)
      .overrideProvider(AuditService).useValue(audit)
      .overrideProvider(SpeciesRepository).useValue(speciesRepo)
      .overrideProvider(BreedRepository).useValue(breedRepo)
      .overrideProvider(PatientRepository).useValue(petRepo)
      .overrideProvider(ClientsRepository).useValue(clientsRepo)
      .overrideProvider(TokenService).useValue(tokens)
      .overrideProvider(AccessService).useValue(access)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  beforeEach(() => {
    patients = [];
    permissions = permissionsOf('receptionist');
  });

  afterAll(async () => {
    await app?.close();
  });

  const validPatient = (overrides: Record<string, unknown> = {}) => ({
    name: 'Firulais',
    speciesId: DOG,
    breedId: LABRADOR,
    gender: 'MALE',
    birthDate: '10-05-2024',
    weightKg: 12.5,
    heightCm: 45,
    reproductiveStatus: 'STERILIZED',
    color: 'Café',
    clientId: ACTIVE_CLIENT,
    ...overrides,
  });

  const post = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/pets').set('Authorization', 'Bearer t').send(body);

  describe('POST /pets', () => {
    it('registra un paciente activo con código PAC-NNNNNN (201)', async () => {
      const res = await post(validPatient()).expect(201);

      expect(res.body.message).toBe('Paciente registrado exitosamente');
      expect(res.body.data).toMatchObject({
        name: 'Firulais',
        status: 'ACTIVE',
        clientId: ACTIVE_CLIENT,
        birthDate: '10-05-2024',
        weightKg: 12.5,
        species: { id: DOG, name: 'Canino' },
        breed: { id: LABRADOR, name: 'Labrador' },
      });
      expect(res.body.data.code).toMatch(/^PAC-\d{6}$/);
      expect(audit.record).toHaveBeenCalledWith({}, expect.objectContaining({ actorId: 'user-1', action: 'Registrar', module: 'Pacientes' }));
    });

    it('asigna códigos distintos a pacientes consecutivos (201)', async () => {
      const first = await post(validPatient()).expect(201);
      const second = await post(validPatient({ name: 'Luna' })).expect(201);

      expect(first.body.data.code).not.toBe(second.body.data.code);
    });

    it('permite registrar al Veterinario (201)', async () => {
      permissions = permissionsOf('veterinarian');

      await post(validPatient()).expect(201);
    });

    it('permite registrar al Gerente (201)', async () => {
      permissions = permissionsOf('manager');

      await post(validPatient()).expect(201);
    });

    it('registra sin color (201)', async () => {
      const { color: _color, ...withoutColor } = validPatient();
      const res = await post(withoutColor).expect(201);

      expect(res.body.data.color).toBeNull();
    });

    it('ignora el código enviado por el usuario (201)', async () => {
      const res = await post(validPatient({ code: 'PAC-999999' })).expect(201);

      expect(res.body.data.code).toBe('PAC-000001');
    });

    it('rechaza campos obligatorios vacíos y los lista (400)', async () => {
      const res = await post({ clientId: ACTIVE_CLIENT, name: '' }).expect(400);

      expect(res.body.message).toBe('Por favor, complete todos los campos obligatorios');
      expect(res.body.errors).toEqual(expect.arrayContaining(['name', 'speciesId', 'breedId', 'birthDate']));
      expect(patients).toHaveLength(0);
    });

    it('exige un cliente (400)', async () => {
      const { clientId: _clientId, ...withoutClient } = validPatient();
      const res = await post(withoutClient).expect(400);

      expect(res.body.message).toBe('Debe seleccionar un cliente registrado');
    });

    it('rechaza un cliente inexistente (404)', async () => {
      const res = await post(validPatient({ clientId: MISSING })).expect(404);

      expect(res.body.message).toBe('Debe seleccionar un cliente registrado');
    });

    it('rechaza un cliente dado de baja (409)', async () => {
      const res = await post(validPatient({ clientId: DEACTIVATED_CLIENT })).expect(409);

      expect(res.body.message).toBe('El cliente seleccionado no está disponible');
      expect(patients).toHaveLength(0);
    });

    it.each(['2024-05-10', '31-02-2024', '01-01-2999'])('rechaza la fecha %s (400)', async (birthDate) => {
      const res = await post(validPatient({ birthDate })).expect(400);

      expect(res.body.message).toBe('Fecha de nacimiento inválida');
    });

    it.each([{ weightKg: 0 }, { heightCm: -1 }, { weightKg: 'abc' }])('rechaza %j (400)', async (override) => {
      const res = await post(validPatient(override)).expect(400);

      expect(res.body.message).toBe('El peso y la talla deben ser valores numéricos mayores que cero');
      expect(res.body.errors).toEqual(Object.keys(override));
    });

    it('rechaza una raza de otra especie (400)', async () => {
      const res = await post(validPatient({ breedId: SIAMESE })).expect(400);

      expect(res.body.message).toBe('La raza no corresponde a la especie seleccionada');
    });

    it('rechaza una raza inactiva (409)', async () => {
      await post(validPatient({ breedId: OLD_BREED })).expect(409);
    });

    it('requiere autenticación (401)', async () => {
      await request(app.getHttpServer()).post('/pets').send(validPatient()).expect(401);
    });

    it('requiere pets:create (403)', async () => {
      permissions = permissionsOf('veterinary_technician');

      await post(validPatient()).expect(403);
      expect(patients).toHaveLength(0);
    });
  });

  describe('GET /pets/species/:speciesId/breeds', () => {
    const get = (speciesId: string) =>
      request(app.getHttpServer()).get(`/pets/species/${speciesId}/breeds`).set('Authorization', 'Bearer t');

    it('devuelve solo las razas activas de la especie, ordenadas (200)', async () => {
      const res = await get(DOG).expect(200);

      expect(res.body.data).toEqual([{ id: LABRADOR, name: 'Labrador' }, { id: POODLE, name: 'Poodle' }]);
    });

    it('devuelve una lista vacía si la especie no tiene razas activas (200)', async () => {
      const res = await get(MISSING).expect(200);

      expect(res.body.data).toEqual([]);
    });

    it('rechaza un identificador sin formato UUID (400)', async () => {
      await get('no-uuid').expect(400);
    });

    it('requiere breeds:read (403)', async () => {
      permissions = new Set(['pets:create']);

      await get(DOG).expect(403);
    });
  });
});
