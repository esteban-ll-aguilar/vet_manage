import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import configuration from '../../src/config/configuration.js';
import { PrismaModule } from '../../src/infrastructure/database/prisma/prisma.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { AuditModule } from '../../src/modules/audit/audit.module.js';
import { AuditService } from '../../src/modules/audit/services/audit.service.js';
import { deleteAuditLogsOfPeople } from './support.js';

const READ_ONLY_MESSAGE = 'Los registros de auditoría no se pueden modificar ni eliminar';

describe('Auditoría (e2e)', () => {
  let prisma: PrismaService;
  let audit: AuditService;
  let close: () => Promise<void>;
  const personIds: string[] = [];
  const roleIds: string[] = [];
  let counter = 0;
  let identificationSeq = 0;

  // Cédula de 10 dígitos única por prueba: 98 + 5 de la hora + 3 de secuencia.
  const newIdentification = () =>
    `98${String(Date.now() % 100_000).padStart(5, '0')}${String(identificationSeq++).padStart(3, '0')}`;

  async function createUser(roles: { id: string; expiresAt?: Date }[] = []) {
    const person = await prisma.person.create({
      data: {
        identification: newIdentification(),
        firstName: 'Auditoría',
        lastName: 'Prueba',
        email: `audit.${Date.now()}.${counter}@e2e-audit.test`,
      },
    });
    personIds.push(person.id);
    const user = await prisma.user.create({
      data: { personId: person.id, userRoles: { create: roles.map(({ id, expiresAt }) => ({ roleId: id, expiresAt })) } },
    });
    return user;
  }

  async function createRole(displayName: string, isActive = true) {
    const role = await prisma.role.create({
      data: { name: `test_audit_${Date.now()}_${counter++}`, displayName, category: 'STAFF', isActive },
    });
    roleIds.push(role.id);
    return role;
  }

  const record = (actorId: string) =>
    prisma.$transaction((tx) =>
      audit.record(tx, { actorId, action: 'Registrar', module: 'Clientes', affectedRecord: '1700000000 - Prueba' }),
    );

  const lastRecord = (userId: string) =>
    prisma.auditLog.findFirstOrThrow({ where: { userId }, orderBy: { occurredAt: 'desc' } });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, load: [configuration] }), PrismaModule, AuditModule],
    }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    audit = moduleRef.get(AuditService);
    close = () => moduleRef.close();
  });

  afterAll(async () => {
    if (!prisma) return;
    await deleteAuditLogsOfPeople(prisma, personIds);
    await prisma.userRole.deleteMany({ where: { user: { personId: { in: personIds } } } });
    await prisma.user.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
    await prisma.role.deleteMany({ where: { id: { in: roleIds } } });
    await close();
  });

  describe('registros de solo lectura', () => {
    it('la base rechaza modificar un registro', async () => {
      const user = await createUser([await createRole('Rol A')]);
      await record(user.id);
      const stored = await lastRecord(user.id);

      await expect(prisma.auditLog.update({ where: { id: stored.id }, data: { action: 'Otra' } })).rejects.toThrow(READ_ONLY_MESSAGE);
      await expect(prisma.auditLog.updateMany({ where: { userId: user.id }, data: { module: 'Otro' } })).rejects.toThrow(READ_ONLY_MESSAGE);
      expect(await lastRecord(user.id)).toMatchObject({ action: 'Registrar', module: 'Clientes' });
    });

    it('la base rechaza eliminar un registro', async () => {
      const user = await createUser([await createRole('Rol A')]);
      await record(user.id);
      const stored = await lastRecord(user.id);

      await expect(prisma.auditLog.delete({ where: { id: stored.id } })).rejects.toThrow(READ_ONLY_MESSAGE);
      await expect(prisma.auditLog.deleteMany({ where: { userId: user.id } })).rejects.toThrow(READ_ONLY_MESSAGE);
      expect(await prisma.auditLog.count({ where: { userId: user.id } })).toBe(1);
    });
  });

  describe('conservación de los registros', () => {
    it('no permite eliminar a un usuario que tiene registros', async () => {
      const user = await createUser([await createRole('Rol A')]);
      await record(user.id);

      await expect(prisma.user.delete({ where: { id: user.id } })).rejects.toMatchObject({ code: 'P2003' });
      expect(await prisma.auditLog.count({ where: { userId: user.id } })).toBe(1);
    });

    it('conserva los registros cuando el usuario se inactiva o se da de baja', async () => {
      const user = await createUser([await createRole('Rol A')]);
      await record(user.id);
      await record(user.id);

      await prisma.user.update({ where: { id: user.id }, data: { status: 'INACTIVE' } });
      await prisma.user.update({ where: { id: user.id }, data: { status: 'DEACTIVATED', deactivatedAt: new Date() } });

      expect(await prisma.auditLog.count({ where: { userId: user.id } })).toBe(2);
    });
  });

  describe('rol del registro', () => {
    it('guarda los roles activos y vigentes en orden alfabético', async () => {
      const gerente = await createRole('Gerente');
      const veterinario = await createRole('Veterinario');
      const vencido = await createRole('Cajero');
      const inactivo = await createRole('Bodeguero', false);
      const user = await createUser([
        { id: veterinario.id },
        { id: gerente.id },
        { id: vencido.id, expiresAt: new Date(Date.now() - 60_000) },
        { id: inactivo.id },
      ]);

      await record(user.id);

      expect((await lastRecord(user.id)).role).toBe('Gerente, Veterinario');
    });

    it('no cambia el rol de un registro existente cuando luego cambian los roles del usuario', async () => {
      const antes = await createRole('Recepcionista');
      const despues = await createRole('Cajero');
      const user = await createUser([antes]);
      await record(user.id);

      await prisma.userRole.deleteMany({ where: { userId: user.id } });
      await prisma.userRole.create({ data: { userId: user.id, roleId: despues.id } });
      await record(user.id);

      const roles = (await prisma.auditLog.findMany({ where: { userId: user.id }, orderBy: { occurredAt: 'asc' } })).map((entry) => entry.role);
      expect(roles).toEqual(['Recepcionista', 'Cajero']);
    });
  });

  describe('atomicidad', () => {
    it('no deja registro cuando la transacción de la acción falla', async () => {
      const user = await createUser([await createRole('Rol A')]);

      await expect(
        prisma.$transaction(async (tx) => {
          await audit.record(tx, { actorId: user.id, action: 'Registrar', module: 'Clientes', affectedRecord: 'x' });
          throw new Error('la acción falló');
        }),
      ).rejects.toThrow('la acción falló');

      expect(await prisma.auditLog.count({ where: { userId: user.id } })).toBe(0);
    });
  });
});
