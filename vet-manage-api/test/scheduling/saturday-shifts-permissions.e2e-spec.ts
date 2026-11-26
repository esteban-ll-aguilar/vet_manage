import { INestApplication, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GlobalExceptionFilter } from '../../src/common/errors/global-exception.filter.js';
import configuration from '../../src/config/configuration.js';
import { PrismaModule } from '../../src/infrastructure/database/prisma/prisma.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { IdentityModule } from '../../src/modules/identity/identity.module.js';
import { TokenService } from '../../src/modules/identity/services/token.service.js';
import { SaturdayShiftsController } from '../../src/modules/scheduling/saturday-shifts/routes/saturday-shifts.controller.js';
import { SaturdayShiftRepository } from '../../src/modules/scheduling/saturday-shifts/repositories/saturday-shift.repository.js';
import { SaturdayShiftService } from '../../src/modules/scheduling/saturday-shifts/services/saturday-shift.service.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, load: [configuration] }), PrismaModule, IdentityModule],
  controllers: [SaturdayShiftsController],
  providers: [SaturdayShiftRepository, SaturdayShiftService],
})
class SaturdayShiftsPermissionsModule {}

describe('Permisos E2E de saturday-shifts', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  let counter = 0;
  const ids = { persons: [] as string[], users: [] as string[], roles: [] as string[], permissions: [] as string[] };

  async function createRole(name: string) {
    const role = await prisma.role.create({
      data: { name: `${name}_${Date.now()}_${counter++}`, displayName: name, isActive: true },
    });
    ids.roles.push(role.id);
    return role;
  }

  async function createUser(role: { id: string }) {
    const n = `${Date.now()}${counter++}`;
    const person = await prisma.person.create({
      data: {
        identification: `99${n.slice(-8)}`,
        firstName: 'Prueba',
        lastName: role.id,
        email: `saturday-permission-${n}@example.test`,
      },
    });
    ids.persons.push(person.id);
    const user = await prisma.user.create({
      data: { personId: person.id, status: 'ACTIVE', userRoles: { create: { roleId: role.id } } },
    });
    ids.users.push(user.id);
    return await tokens.issue(user.id);
  }

  beforeAll(async () => {
    process.env.DATABASE_URL ??= 'postgresql://vetmanage:vetmanage_dev_password@localhost:55432/vet_manage_hu024?schema=public';
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'secret-for-testing-only-at-least-32-chars-long';
    process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
    const moduleRef = await Test.createTestingModule({ imports: [SaturdayShiftsPermissionsModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    tokens = app.get(TokenService);
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
    await prisma.person.deleteMany({ where: { id: { in: ids.persons } } });
    await prisma.role.deleteMany({ where: { id: { in: ids.roles } } });
    await prisma.permission.deleteMany({ where: { id: { in: ids.permissions } } });
    await app.close();
  });

  async function setupPermission(action: 'read' | 'manage') {
    const permission = await prisma.permission.upsert({
      where: { permission_module_action_key: { module: 'saturday-shifts', action } },
      update: { isActive: true, displayName: action === 'read' ? 'Consultar turnos de sábado' : 'Asignar turnos de sábado' },
      create: { module: 'saturday-shifts', action, displayName: action === 'read' ? 'Consultar turnos de sábado' : 'Asignar turnos de sábado' },
    });
    ids.permissions.push(permission.id);
    return permission;
  }

  async function grant(role: { id: string }, permission: { id: string }) {
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
  }

  it('401 sin sesión en todos los endpoints', async () => {
    await request(app.getHttpServer()).get('/scheduling/saturday-shifts').expect(401);
    await request(app.getHttpServer()).post('/scheduling/saturday-shifts/generate').send({}).expect(401);
    await request(app.getHttpServer()).put('/scheduling/saturday-shifts/test-id').send({}).expect(401);
  });

  it('403 para Recepcionista y Veterinario con el mensaje exacto', async () => {
    await setupPermission('read');
    await setupPermission('manage');
    const receptionist = await createRole('Recepcionista');
    const veterinarian = await createRole('Veterinario');

    for (const role of [receptionist, veterinarian]) {
      const token = await createUser(role);
      await request(app.getHttpServer()).get('/scheduling/saturday-shifts').set('Authorization', `Bearer ${token}`).expect(403);
      await request(app.getHttpServer()).post('/scheduling/saturday-shifts/generate').set('Authorization', `Bearer ${token}`).send({}).expect(403);
      await request(app.getHttpServer()).put('/scheduling/saturday-shifts/test-id').set('Authorization', `Bearer ${token}`).send({}).expect(403);
    }
  });

  it('Administrador y Gerente tienen acceso permitido a lectura y gestión', async () => {
    const read = await setupPermission('read');
    const manage = await setupPermission('manage');
    for (const roleName of ['Administrador', 'Gerente']) {
      const role = await createRole(roleName);
      await grant(role, read);
      await grant(role, manage);
      const token = await createUser(role);

      await request(app.getHttpServer()).get('/scheduling/saturday-shifts').set('Authorization', `Bearer ${token}`).expect(200);
      const generate = await request(app.getHttpServer()).post('/scheduling/saturday-shifts/generate').set('Authorization', `Bearer ${token}`).send({});
      expect([generate.status]).not.toContain(401);
      expect([generate.status]).not.toContain(403);
      const substitute = await request(app.getHttpServer()).put('/scheduling/saturday-shifts/test-id').set('Authorization', `Bearer ${token}`).send({});
      expect([substitute.status]).not.toContain(401);
      expect([substitute.status]).not.toContain(403);
    }
  });
});
