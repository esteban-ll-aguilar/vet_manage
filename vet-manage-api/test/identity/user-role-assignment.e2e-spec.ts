import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GlobalExceptionFilter } from '../../src/common/errors/global-exception.filter.js';
import configuration from '../../src/config/configuration.js';
import { PrismaModule } from '../../src/infrastructure/database/prisma/prisma.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { IdentityModule } from '../../src/modules/identity/identity.module.js';
import { AccessService } from '../../src/modules/identity/services/access.service.js';
import { TokenService } from '../../src/modules/identity/services/token.service.js';
import { deleteAuditLogsOfPeople } from './support.js';

const EMAIL_DOMAIN = '@e2e-roleassign.test';
let counter = 0;

function newIdentification() {
  return `97${`${Date.now()}${counter++}`.slice(-8)}`;
}
function newEmail() {
  return `ra.${Date.now()}.${counter++}${EMAIL_DOMAIN}`;
}

describe('Asignación de roles (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  let access: AccessService;
  let adminToken: string;
  let cashierToken: string;
  let adminRole: { id: string; name: string };
  let cashierRole: { id: string; name: string };
  let receptionRole: { id: string; name: string };
  const roleIds: string[] = [];
  const personIds: string[] = [];

  async function ensureRole(name: string, displayName: string, category: 'STAFF' | 'CLIENT' = 'STAFF') {
    const role = await prisma.role.upsert({
      where: { name },
      update: { isActive: true, category, displayName },
      create: { name, displayName, category, isActive: true },
    });
    return role;
  }

  async function createRole(name: string, displayName: string, permissions: string[] = []) {
    const role = await prisma.role.create({ data: { name, displayName, category: 'STAFF', isActive: true } });
    roleIds.push(role.id);
    for (const key of permissions) {
      const [module, action] = key.split(':');
      const permission = await prisma.permission.upsert({
        where: { permission_module_action_key: { module, action } },
        update: { isActive: true },
        create: { module, action, displayName: key, isActive: true },
      });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
    return role;
  }

  async function createPerson(firstName = 'Usuario', lastName = 'Prueba', overrides: { status?: 'ACTIVE' | 'INACTIVE' | 'DEACTIVATED' } = {}) {
    const person = await prisma.person.create({
      data: { identification: newIdentification(), firstName, lastName, email: newEmail() },
    });
    personIds.push(person.id);
    const user = await prisma.user.create({ data: { personId: person.id, status: overrides.status ?? 'ACTIVE' } });
    return user.id;
  }

  async function assign(userId: string, roleId: string, opts: { expiresAt?: Date } = {}) {
    return prisma.userRole.create({ data: { userId, roleId, expiresAt: opts.expiresAt } });
  }

  const getRoles = (userId: string, token: string | null = adminToken) => {
    const call = request(app.getHttpServer()).get(`/users/${userId}/role-assignment`);
    return token ? call.set('Authorization', `Bearer ${token}`) : call;
  };

  const putRoles = (userId: string, roles: string[], token: string | null = adminToken) => {
    const call = request(app.getHttpServer()).put(`/users/${userId}/role-assignment`).send({ roles });
    return token ? call.set('Authorization', `Bearer ${token}`) : call;
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, load: [configuration] }), PrismaModule, IdentityModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    prisma = app.get(PrismaService);
    tokens = app.get(TokenService);
    access = app.get(AccessService);

    const suffix = `${Date.now()}`;
    adminRole = await ensureRole('administrator', 'Administrador');
    await ensureRole('veterinarian', 'Veterinario');
    cashierRole = await ensureRole('cashier', 'Cajero');
    receptionRole = await ensureRole('receptionist', 'Recepcionista');

    const managerRole = await createRole(`test_ra_manager_${suffix}`, 'Administrador RA', ['users:assign-roles']);
    const plainRole = await createRole(`test_ra_plain_${suffix}`, 'Sin permiso RA', []);

    const adminUserId = await createPerson('Admin', 'Roles');
    await assign(adminUserId, managerRole.id);
    adminToken = await tokens.issue(adminUserId);

    const cashierUserId = await createPerson('Caja', 'Roles');
    await assign(cashierUserId, plainRole.id);
    cashierToken = await tokens.issue(cashierUserId);
  });

  afterAll(async () => {
    if (!prisma) return;
    await deleteAuditLogsOfPeople(prisma, personIds);
    await prisma.userRole.deleteMany({ where: { user: { personId: { in: personIds } } } });
    await prisma.user.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
    await prisma.rolePermission.deleteMany({ where: { roleId: { in: roleIds } } });
    await prisma.role.deleteMany({ where: { id: { in: roleIds } } });
    await app.close();
  });

  it('consulta roles actuales y disponibles excluyendo los ya asignados', async () => {
    const userId = await createPerson('Carlos', 'Pérez');
    await assign(userId, receptionRole.id);

    const response = await getRoles(userId).expect(200);

    expect(response.body.data.user).toMatchObject({ id: userId, fullName: 'Carlos Pérez' });
    expect(response.body.data.currentRoles.map((r: { name: string }) => r.name)).toContain('receptionist');
    expect(response.body.data.availableRoles.map((r: { name: string }) => r.name)).not.toContain('receptionist');
    expect(response.body.data.availableRoles.map((r: { name: string }) => r.name)).toContain('cashier');
  });

  it('asigna un rol adicional y se refleja en los permisos efectivos', async () => {
    const userId = await createPerson('Carlos', 'Pérez');
    await assign(userId, receptionRole.id);

    const response = await putRoles(userId, ['receptionist', 'cashier']).expect(200);

    expect(response.body.message).toBe('Roles actualizados correctamente');
    const names = response.body.data.currentRoles.map((r: { name: string }) => r.name);
    expect(names).toEqual(expect.arrayContaining(['receptionist', 'cashier']));
    const active = await access.getActiveRoles(userId);
    expect(active.map((r) => r.name)).toEqual(expect.arrayContaining(['receptionist', 'cashier']));

    const auditRecord = await prisma.auditLog.findFirst({
      where: { action: 'Asignar roles', affectedRecord: { endsWith: 'Carlos Pérez' } },
      orderBy: { occurredAt: 'desc' },
    });
    expect(auditRecord).toMatchObject({
      module: 'Usuarios',
      previousValue: ['Recepcionista'],
      newValue: ['Cajero', 'Recepcionista'],
    });
  });

  it('quita un rol y cambia de función reemplazando el conjunto', async () => {
    const userId = await createPerson('Carlos', 'Pérez');
    await assign(userId, receptionRole.id);
    await assign(userId, cashierRole.id);

    const removed = await putRoles(userId, ['receptionist']).expect(200);
    expect(removed.body.data.currentRoles.map((r: { name: string }) => r.name)).toEqual(['receptionist']);

    const changed = await putRoles(userId, ['veterinarian']).expect(200);
    expect(changed.body.data.currentRoles.map((r: { name: string }) => r.name)).toEqual(['veterinarian']);
    const permissions = await access.getPermissionKeys(userId);
    expect(permissions.has('medical-history:read')).toBe(true);
  });

  it('impide dejar al usuario sin roles', async () => {
    const userId = await createPerson('Carlos', 'Pérez');
    await assign(userId, receptionRole.id);

    const response = await putRoles(userId, []).expect(400);

    expect(response.body.message).toBe('El usuario debe tener al menos un rol');
    expect((await access.getActiveRoles(userId)).map((r) => r.name)).toEqual(['receptionist']);
  });

  it('impide quitar el último Administrador activo', async () => {
    const existingAdmins = await prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        userRoles: {
          some: {
            role: { name: 'administrator', isActive: true },
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
        },
      },
      include: { userRoles: { include: { role: true } } },
    });
    const extra = existingAdmins.slice(1);
    for (const u of extra) {
      for (const ur of u.userRoles.filter((r) => r.role.name === 'administrator')) {
        await prisma.userRole.update({ where: { id: ur.id }, data: { expiresAt: new Date('2020-01-01') } });
      }
    }

    try {
      const target = existingAdmins[0] ?? await (async () => {
        const id = await createPerson('Solo', 'Admin');
        await assign(id, adminRole.id);
        return prisma.user.findUniqueOrThrow({ where: { id }, include: { userRoles: { include: { role: true } } } });
      })();

      const response = await putRoles(target.id, ['cashier']).expect(400);
      expect(response.body.message).toBe('Debe existir al menos un Administrador activo');
      const roles = await access.getActiveRoles(target.id);
      expect(roles.map((r) => r.name)).toContain('administrator');
    } finally {
      for (const u of extra) {
        for (const ur of u.userRoles.filter((r) => r.role.name === 'administrator')) {
          await prisma.userRole.update({ where: { id: ur.id }, data: { expiresAt: null } });
        }
      }
    }
  });

  it('impide modificar roles de un usuario dado de baja', async () => {
    const userId = await createPerson('Luis', 'Ríos', { status: 'DEACTIVATED' });
    await assign(userId, receptionRole.id);

    const response = await putRoles(userId, ['cashier']).expect(400);

    expect(response.body.message).toBe('No se pueden modificar los roles de un usuario dado de baja');
  });

  it('rechaza sin sesión, sin permiso y usuario inexistente', async () => {
    await getRoles('00000000-0000-0000-0000-000000000000', null).expect(401);
    await putRoles('00000000-0000-0000-0000-000000000000', ['cashier'], null).expect(401);

    const userId = await createPerson('Carlos', 'Pérez');
    await assign(userId, receptionRole.id);
    const denied = await putRoles(userId, ['cashier'], cashierToken).expect(403);
    expect(denied.body.message).toBe('No tiene permisos para realizar esta acción');

    await getRoles('00000000-0000-0000-0000-000000000000').expect(404);
  });
});
