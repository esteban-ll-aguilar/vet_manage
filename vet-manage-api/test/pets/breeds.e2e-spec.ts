import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import configuration from '../../src/config/configuration.js';
import { GlobalExceptionFilter } from '../../src/common/errors/global-exception.filter.js';
import { PetsModule } from '../../src/modules/pets/pets.module.js';
import { SpeciesRepository } from '../../src/modules/pets/repositories/species.repository.js';
import { BreedRepository } from '../../src/modules/pets/repositories/breed.repository.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { AuditService } from '../../src/modules/audit/services/audit.service.js';
import { AccessService } from '../../src/modules/identity/services/access.service.js';
import { TokenService } from '../../src/modules/identity/services/token.service.js';

const ACTIVE = '123e4567-e89b-12d3-a456-426614174000';
const OTHER_ACTIVE = '123e4567-e89b-12d3-a456-426614174001';
const INACTIVE = '123e4567-e89b-12d3-a456-426614174002';
const MISSING = '123e4567-e89b-12d3-a456-426614174999';

describe('BreedController (e2e)', () => {
  let app: INestApplication;
  let permissions: Set<string>;
  let breeds: Array<{ id: string; name: string; speciesId: string; description: string | null; isActive: boolean }>;
  const speciesDb = [
    { id: ACTIVE, name: 'Canino', isActive: true },
    { id: OTHER_ACTIVE, name: 'Felino', isActive: true },
    { id: INACTIVE, name: 'Reptil', isActive: false },
  ];

  const tokens = { verify: vi.fn(async () => 'user-1') };
  const audit = { record: vi.fn(async () => undefined) };
  const prisma = { $transaction: vi.fn(async (run: (client: unknown) => unknown) => run({})) };
  const access = {
    findActiveUser: vi.fn(async () => ({ id: 'user-1' })),
    getPermissionKeys: vi.fn(async () => permissions),
  };
  const speciesRepo = {
    findById: vi.fn(async (id: string) => speciesDb.find((s) => s.id === id) ?? null),
    findActive: vi.fn(async () =>
      speciesDb.filter((s) => s.isActive).map(({ id, name }) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))),
  };
  const breedRepo = {
    findByNameInSpecies: vi.fn(async (speciesId: string, name: string) =>
      breeds.find((b) => b.speciesId === speciesId && b.name.toLowerCase() === name.trim().toLowerCase()) ?? null),
    create: vi.fn(async (data: { name: string; speciesId: string; description?: string | null }) => {
      const created = {
        id: `breed-${breeds.length + 1}`,
        name: data.name,
        speciesId: data.speciesId,
        description: data.description?.trim() || null,
        isActive: true,
      };
      breeds.push(created);
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
      .overrideProvider(TokenService).useValue(tokens)
      .overrideProvider(AccessService).useValue(access)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  beforeEach(() => {
    breeds = [];
    permissions = new Set(['breeds:create', 'species:read']);
  });

  afterAll(async () => {
    await app?.close();
  });

  const post = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/pets/breeds').set('Authorization', 'Bearer t').send(body);

  it('POST /pets/breeds registers a breed with description (201)', async () => {
    const res = await post({ name: 'Labrador', speciesId: ACTIVE, description: 'Grande' }).expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Raza registrada exitosamente');
    expect(res.body.data).toMatchObject({ name: 'Labrador', speciesId: ACTIVE, description: 'Grande', isActive: true });
    expect(audit.record).toHaveBeenCalledWith({}, expect.objectContaining({ actorId: 'user-1', action: 'Registrar', module: 'Razas' }));
  });

  it('POST /pets/breeds registers a breed without description (201)', async () => {
    const res = await post({ name: 'Labrador', speciesId: ACTIVE }).expect(201);

    expect(res.body.data.description).toBeNull();
  });

  it('POST /pets/breeds trims the name (201)', async () => {
    const res = await post({ name: '  Labrador  ', speciesId: ACTIVE }).expect(201);

    expect(res.body.data.name).toBe('Labrador');
  });

  it('POST /pets/breeds rejects a description over 500 characters (400)', async () => {
    await post({ name: 'Labrador', speciesId: ACTIVE, description: 'x'.repeat(501) }).expect(400);
  });

  it('POST /pets/breeds rejects a missing name (400)', async () => {
    const res = await post({ name: '', speciesId: ACTIVE }).expect(400);

    expect(res.body.success).toBe(false);
  });

  it('POST /pets/breeds rejects a whitespace-only name (400)', async () => {
    await post({ name: '   ', speciesId: ACTIVE }).expect(400);
  });

  it('POST /pets/breeds rejects a missing species (400)', async () => {
    await post({ name: 'Labrador' }).expect(400);
  });

  it('POST /pets/breeds rejects a malformed species id (400)', async () => {
    await post({ name: 'Labrador', speciesId: 'no-uuid' }).expect(400);
  });

  it('POST /pets/breeds rejects an unknown species (404)', async () => {
    await post({ name: 'Labrador', speciesId: MISSING }).expect(404);
  });

  it('POST /pets/breeds rejects an inactive species (409)', async () => {
    const res = await post({ name: 'Iguana', speciesId: INACTIVE }).expect(409);

    expect(res.body.message).toContain('inactiva');
    expect(breeds).toHaveLength(0);
  });

  it('POST /pets/breeds rejects a duplicate name ignoring case in the same species (409)', async () => {
    await post({ name: 'Labrador', speciesId: ACTIVE }).expect(201);
    await post({ name: 'LABRADOR', speciesId: ACTIVE }).expect(409);
  });

  it('POST /pets/breeds allows the same name in another species (201)', async () => {
    await post({ name: 'Mestizo', speciesId: ACTIVE }).expect(201);
    await post({ name: 'Mestizo', speciesId: OTHER_ACTIVE }).expect(201);
  });

  it('POST /pets/breeds requires authentication (401)', async () => {
    await request(app.getHttpServer()).post('/pets/breeds').send({ name: 'Labrador', speciesId: ACTIVE }).expect(401);
  });

  it('POST /pets/breeds requires breeds:create (403)', async () => {
    permissions = new Set(['species:read']);

    await post({ name: 'Labrador', speciesId: ACTIVE }).expect(403);
    expect(breeds).toHaveLength(0);
  });

  it('GET /pets/species/active returns only active species sorted by name (200)', async () => {
    const res = await request(app.getHttpServer()).get('/pets/species/active').set('Authorization', 'Bearer t').expect(200);

    expect(res.body.data).toEqual([{ id: ACTIVE, name: 'Canino' }, { id: OTHER_ACTIVE, name: 'Felino' }]);
  });

  it('GET /pets/species/active requires authentication (401)', async () => {
    await request(app.getHttpServer()).get('/pets/species/active').expect(401);
  });

  it('GET /pets/species/active requires species:read (403)', async () => {
    permissions = new Set(['breeds:create']);

    await request(app.getHttpServer()).get('/pets/species/active').set('Authorization', 'Bearer t').expect(403);
  });
});
