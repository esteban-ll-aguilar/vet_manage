import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { describe, beforeAll, afterAll, it, expect, vi } from 'vitest';
import configuration from '../../src/config/configuration.js';
import { GlobalExceptionFilter } from '../../src/common/errors/global-exception.filter.js';
import { PetsModule } from '../../src/modules/pets/pets.module.js';
import { SpeciesRepository } from '../../src/modules/pets/repositories/species.repository.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { AuditService } from '../../src/modules/audit/services/audit.service.js';
import { AccessService } from '../../src/modules/identity/services/access.service.js';
import { TokenService } from '../../src/modules/identity/services/token.service.js';

describe('SpeciesController (e2e)', () => {
  let app: INestApplication;
  let mockSpeciesDb: any[] = [];
  const tokens = { verify: vi.fn(async () => 'user-1') };
  const audit = { record: vi.fn(async () => undefined) };
  const prisma = { $transaction: vi.fn(async (run: (client: unknown) => unknown) => run({})) };
  const access = {
    findActiveUser: vi.fn(async () => ({ id: 'user-1' })),
    getPermissionKeys: vi.fn(async () => new Set(['species:create', 'species:read'])),
  };

  const mockSpeciesRepo = {
    findByName: vi.fn(async (name: string) => {
      return mockSpeciesDb.find((s) => s.name.toLowerCase() === name.trim().toLowerCase()) || null;
    }),
    findById: vi.fn(async (id: string) => {
      return mockSpeciesDb.find((s) => s.id === id) || null;
    }),
    create: vi.fn(async (data: { name: string; description?: string | null }) => {
      const created = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: data.name,
        description: data.description || null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockSpeciesDb.push(created);
      return created;
    }),
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/vet_manage';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'secret-for-testing-only-at-least-32-chars-long';
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
        PetsModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(AuditService)
      .useValue(audit)
      .overrideProvider(SpeciesRepository)
      .useValue(mockSpeciesRepo)
      .overrideProvider(TokenService)
      .useValue(tokens)
      .overrideProvider(AccessService)
      .useValue(access)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('POST /pets/species - registra una nueva especie con éxito (201)', async () => {
    const res = await request(app.getHttpServer())
      .post('/pets/species')
      .set('Authorization', 'Bearer test-token')
      .send({
        name: 'Canino',
        description: 'Perros domésticos',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Canino');
    expect(res.body.data.description).toBe('Perros domésticos');
    expect(res.body.data.isActive).toBe(true);
    expect(audit.record).toHaveBeenCalledWith({}, {
      actorId: 'user-1',
      action: 'Registrar',
      module: 'Especies',
      affectedRecord: 'Canino',
    });
  });

  it('POST /pets/species - registra una nueva especie sin descripción (201)', async () => {
    const res = await request(app.getHttpServer())
      .post('/pets/species')
      .set('Authorization', 'Bearer test-token')
      .send({
        name: 'Felino',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Felino');
    expect(res.body.data.description).toBeNull();
  });

  it('POST /pets/species - rechaza solicitud con nombre vacío (400)', async () => {
    const res = await request(app.getHttpServer())
      .post('/pets/species')
      .set('Authorization', 'Bearer test-token')
      .send({
        name: '',
      })
      .expect(400);

    expect(res.body.success).toBe(false);
  });

  it('POST /pets/species - rechaza duplicados con error de conflicto (409)', async () => {
    const res = await request(app.getHttpServer())
      .post('/pets/species')
      .set('Authorization', 'Bearer test-token')
      .send({
        name: 'Canino',
      })
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Ya existe una especie registrada con el nombre "Canino"');
  });

  it('POST /pets/species - rechaza duplicados sin distinguir mayúsculas (409)', async () => {
    const res = await request(app.getHttpServer())
      .post('/pets/species')
      .set('Authorization', 'Bearer test-token')
      .send({
        name: 'canino',
      })
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Ya existe una especie registrada con el nombre "canino"');
  });

  it('POST /pets/species - rechaza la solicitud sin autenticación (401)', async () => {
    const res = await request(app.getHttpServer())
      .post('/pets/species')
      .send({ name: 'Equino' })
      .expect(401);

    expect(res.body.success).toBe(false);
  });

  it('POST /pets/species - rechaza al usuario sin el permiso requerido (403)', async () => {
    access.getPermissionKeys.mockResolvedValueOnce(new Set());

    const res = await request(app.getHttpServer())
      .post('/pets/species')
      .set('Authorization', 'Bearer test-token')
      .send({ name: 'Equino' })
      .expect(403);

    expect(res.body.success).toBe(false);
  });
});
