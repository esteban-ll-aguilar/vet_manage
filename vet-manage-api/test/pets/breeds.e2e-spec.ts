import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import configuration from '../../src/config/configuration.js';
import { ROLES } from '../../src/config/roles.catalog.js';
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
  const withSpecies = (b: (typeof breeds)[number]) => {
    const species = speciesDb.find((s) => s.id === b.speciesId)!;
    return { ...b, species: { id: species.id, name: species.name } };
  };
  const breedRepo = {
    // Simula la consulta de HU-20: alguna variante contenida en el nombre (sin mayúsculas) y especie.
    findByFilters: vi.fn(async ({ nameVariants, speciesId }: { nameVariants?: string[]; speciesId?: string }) =>
      breeds
        .filter((b) => !speciesId || b.speciesId === speciesId)
        .filter((b) => !nameVariants?.length || nameVariants.some((v) => b.name.toLowerCase().includes(v.toLowerCase())))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(withSpecies)),
    findByIdWithSpecies: vi.fn(async (id: string) => {
      const found = breeds.find((b) => b.id === id);
      return found ? withSpecies(found) : null;
    }),
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

  // Matriz de roles, sección 2.4: el Administrador no tiene acceso a razas.
  const adminPermissions = () =>
    new Set<string>(ROLES.find((role) => role.name === 'administrator')?.permissions ?? []);

  it('POST /pets/breeds rejects the Administrator (403)', async () => {
    permissions = adminPermissions();

    await post({ name: 'Labrador', speciesId: ACTIVE }).expect(403);
  });

  it('GET /pets/species/:speciesId/breeds requires authentication (401)', async () => {
    await request(app.getHttpServer()).get(`/pets/species/${ACTIVE}/breeds`).expect(401);
  });

  it('GET /pets/species/:speciesId/breeds rejects the Administrator (403)', async () => {
    permissions = adminPermissions();

    await request(app.getHttpServer()).get(`/pets/species/${ACTIVE}/breeds`).set('Authorization', 'Bearer t').expect(403);
  });

  describe('HU-20 Consultar raza', () => {
    const list = (query = '') =>
      request(app.getHttpServer()).get(`/pets/breeds${query}`).set('Authorization', 'Bearer t');

    beforeEach(() => {
      permissions = new Set(['breeds:read']);
      audit.record.mockClear();
      breeds = [
        { id: '9a000000-0000-4000-8000-000000000001', name: 'Labrador Retriever', speciesId: ACTIVE, description: 'Perro de talla grande', isActive: true },
        { id: '9a000000-0000-4000-8000-000000000002', name: 'Mestizo', speciesId: ACTIVE, description: null, isActive: true },
        { id: '9a000000-0000-4000-8000-000000000003', name: 'Mestizo', speciesId: OTHER_ACTIVE, description: null, isActive: true },
        { id: '9a000000-0000-4000-8000-000000000004', name: 'Siamés', speciesId: OTHER_ACTIVE, description: 'Ojos azules', isActive: true },
        { id: '9a000000-0000-4000-8000-000000000005', name: 'Persa', speciesId: OTHER_ACTIVE, description: null, isActive: false },
      ];
    });

    // Positivos
    it('sin filtros devuelve todas las razas, activas e inactivas, ordenadas por nombre (200)', async () => {
      const res = await list().expect(200);
      expect(res.body.data.map((b: { name: string }) => b.name)).toEqual(['Labrador Retriever', 'Mestizo', 'Mestizo', 'Persa', 'Siamés']);
      expect(res.body.data[0]).toMatchObject({ isActive: true, species: { id: ACTIVE, name: 'Canino' } });
    });

    it('busca por coincidencia parcial del nombre (200)', async () => {
      const res = await list('?search=labra').expect(200);
      expect(res.body.data.map((b: { name: string }) => b.name)).toEqual(['Labrador Retriever']);
    });

    it('busca sin mayúsculas ni tildes: SIAMES encuentra Siamés (200)', async () => {
      const res = await list('?search=SIAMES').expect(200);
      expect(res.body.data.map((b: { name: string }) => b.name)).toEqual(['Siamés']);
    });

    it('filtra por especie (200)', async () => {
      const res = await list(`?speciesId=${OTHER_ACTIVE}`).expect(200);
      expect(res.body.data.every((b: { speciesId: string }) => b.speciesId === OTHER_ACTIVE)).toBe(true);
      expect(res.body.data).toHaveLength(3);
    });

    it('combina búsqueda y especie: Mestizo de Canino y no de Felino (200)', async () => {
      const res = await list(`?search=mestizo&speciesId=${ACTIVE}`).expect(200);
      expect(res.body.data).toEqual([expect.objectContaining({ name: 'Mestizo', speciesId: ACTIVE })]);
    });

    it('incluye razas inactivas en la búsqueda (200)', async () => {
      const res = await list('?search=persa').expect(200);
      expect(res.body.data).toEqual([expect.objectContaining({ name: 'Persa', isActive: false })]);
    });

    it('devuelve el detalle de una raza con su especie, descripción y estado (200)', async () => {
      const res = await request(app.getHttpServer()).get('/pets/breeds/9a000000-0000-4000-8000-000000000004')
        .set('Authorization', 'Bearer t').expect(200);
      expect(res.body.data).toMatchObject({ name: 'Siamés', description: 'Ojos azules', isActive: true, species: { name: 'Felino' } });
    });

    // Negativos
    it('sin resultados devuelve lista vacía con el mensaje de la HU (200)', async () => {
      const res = await list('?search=xyz').expect(200);
      expect(res.body).toMatchObject({ data: [], message: 'No se encontraron razas con el criterio ingresado' });
    });

    it('rechaza un speciesId que no es UUID con "Especie no válida" (400)', async () => {
      const res = await list('?speciesId=felino').expect(400);
      expect(res.body.message).toBe('Especie no válida');
    });

    it('detalle de una raza inexistente responde "Raza no encontrada" (404)', async () => {
      const res = await request(app.getHttpServer()).get(`/pets/breeds/${MISSING}`).set('Authorization', 'Bearer t').expect(404);
      expect(res.body.message).toBe('Raza no encontrada');
    });

    it('detalle con id que no es UUID responde 400', async () => {
      await request(app.getHttpServer()).get('/pets/breeds/no-es-uuid').set('Authorization', 'Bearer t').expect(400);
    });

    it('requiere sesión (401)', async () => {
      await request(app.getHttpServer()).get('/pets/breeds').expect(401);
    });

    it('rechaza a un usuario sin breeds:read, como el Cajero (403)', async () => {
      permissions = new Set(ROLES.find((role) => role.name === 'cashier')?.permissions ?? []);
      await list().expect(403);
    });

    it('rechaza al Administrador en el listado y en el detalle (403)', async () => {
      permissions = adminPermissions();
      await list().expect(403);
      await request(app.getHttpServer()).get('/pets/breeds/9a000000-0000-4000-8000-000000000001').set('Authorization', 'Bearer t').expect(403);
    });

    it('buscar y ver el detalle no registran auditoría', async () => {
      await list('?search=labra').expect(200);
      await request(app.getHttpServer()).get('/pets/breeds/9a000000-0000-4000-8000-000000000001').set('Authorization', 'Bearer t').expect(200);
      expect(audit.record).not.toHaveBeenCalled();
    });

    // Valor límite
    it('una búsqueda solo con espacios se ignora y devuelve todas las razas (200)', async () => {
      const res = await list('?search=%20%20%20').expect(200);
      expect(res.body.data).toHaveLength(5);
    });

    it('acepta una búsqueda de 1 carácter (200)', async () => {
      const res = await list('?search=p').expect(200);
      expect(res.body.data.map((b: { name: string }) => b.name)).toEqual(['Persa']);
    });

    it('acepta una búsqueda de 100 caracteres (200)', async () => {
      await list(`?search=${'b'.repeat(100)}`).expect(200);
    });

    it('rechaza una búsqueda de 101 caracteres (400)', async () => {
      const res = await list(`?search=${'b'.repeat(101)}`).expect(400);
      expect(res.body.message).toBe('La búsqueda no puede superar 100 caracteres');
    });
  });
});
