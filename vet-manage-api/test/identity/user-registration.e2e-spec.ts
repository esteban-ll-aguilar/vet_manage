import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { GlobalExceptionFilter } from '../../src/common/errors/global-exception.filter.js';
import { verifyPassword } from '../../src/common/security/password-hash.js';
import { identificationCheckDigit } from '../../src/common/validation/identification.js';
import configuration from '../../src/config/configuration.js';
import { PrismaModule } from '../../src/infrastructure/database/prisma/prisma.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { MailModule } from '../../src/infrastructure/mail/mail.module.js';
import { MailService } from '../../src/infrastructure/mail/mail.service.js';
import { IdentityModule } from '../../src/modules/identity/identity.module.js';
import { PasswordHasher } from '../../src/modules/identity/services/password-hasher.service.js';
import { TokenService } from '../../src/modules/identity/services/token.service.js';
import { deleteAuditLogsOfPeople } from './support.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, load: [configuration] }), PrismaModule, MailModule, IdentityModule],
})
class TestRegistrationModule {}

const EMAIL_DOMAIN = '@e2e-registro.test';

describe('Registro de usuarios (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  let hasher: PasswordHasher;
  let adminToken: string;
  let adminId: string;
  let staffRole: { id: string; name: string };
  let secondStaffRole: { id: string; name: string };
  let clientRole: { id: string; name: string };
  const send = vi.fn();
  const roleIds: string[] = [];
  let counter = 0;

  // Cédula ecuatoriana válida y única por prueba.
  function newIdentification() {
    const nine = `172${`${Date.now()}${counter++}`.slice(-6)}`;
    return `${nine}${identificationCheckDigit(nine)}`;
  }

  const newEmail = () => `e2e.${Date.now()}.${counter++}${EMAIL_DOMAIN}`;

  const body = (overrides: Record<string, unknown> = {}) => ({
    identification: newIdentification(),
    firstName: 'María',
    lastName: 'López',
    email: newEmail(),
    phone: '0991234567',
    roles: [staffRole.name],
    ...overrides,
  });

  const register = (payload: object, token: string | null = adminToken) => {
    const call = request(app.getHttpServer()).post('/users').send(payload);
    return token ? call.set('Authorization', `Bearer ${token}`) : call;
  };

  async function createRole(category: 'STAFF' | 'CLIENT', permissionKeys: string[] = []) {
    const role = await prisma.role.create({
      data: { name: `test_reg_${Date.now()}_${counter++}`, displayName: 'Rol de prueba', category },
    });
    roleIds.push(role.id);
    for (const key of permissionKeys) {
      const [module, action] = key.split(':');
      const permission = await prisma.permission.upsert({
        where: { permission_module_action_key: { module, action } },
        update: {},
        create: { module, action, displayName: key },
      });
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
    }
    return role;
  }

  async function createAccount(roles: { id: string }[], password: string | null = null) {
    const person = await prisma.person.create({
      data: { identification: newIdentification(), firstName: 'Ana', lastName: 'Ruiz', email: newEmail() },
    });
    const user = await prisma.user.create({
      data: { personId: person.id, password, userRoles: { create: roles.map((role) => ({ roleId: role.id })) } },
    });
    return { person, user };
  }

  const findByEmail = (email: string) =>
    prisma.person.findFirst({
      where: { email },
      include: { user: { include: { userRoles: true } } },
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [TestRegistrationModule] })
      .overrideProvider(MailService)
      .useValue({ send })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    prisma = app.get(PrismaService);
    tokens = app.get(TokenService);
    hasher = app.get(PasswordHasher);

    staffRole = await createRole('STAFF');
    secondStaffRole = await createRole('STAFF');
    clientRole = await createRole('CLIENT');
    const adminRole = await createRole('STAFF', ['users:create']);
    ({ user: { id: adminId } } = await createAccount([adminRole]));
    adminToken = await tokens.issue(adminId);
  });

  beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    if (!prisma) return;
    const people = await prisma.person.findMany({
      where: { email: { endsWith: EMAIL_DOMAIN } },
      select: { id: true },
    });
    const personIds = people.map((person) => person.id);
    await deleteAuditLogsOfPeople(prisma, personIds);
    await prisma.userRole.deleteMany({ where: { user: { personId: { in: personIds } } } });
    await prisma.user.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
    await prisma.role.deleteMany({ where: { id: { in: roleIds } } });
    await app.close();
  });

  it('registra un usuario con un rol, contraseña temporal y envía las credenciales', async () => {
    const payload = body();

    const response = await register(payload).expect(201);

    expect(response.body.message).toBe('Usuario registrado correctamente');
    expect(response.body.data).toMatchObject({
      identification: payload.identification,
      email: payload.email,
      status: 'ACTIVE',
      existingPerson: false,
      passwordAssigned: true,
      credentialsSent: true,
      roles: [{ name: staffRole.name, displayName: 'Rol de prueba' }],
    });
    expect(JSON.stringify(response.body)).not.toMatch(/"password"|"mustChangePassword"/);

    const stored = await findByEmail(payload.email);
    expect(stored?.user).toMatchObject({ status: 'ACTIVE', mustChangePassword: true });
    expect(stored?.user?.userRoles).toMatchObject([{ roleId: staffRole.id, assignedById: adminId }]);

    expect(send).toHaveBeenCalledTimes(1);
    const mail = send.mock.calls[0][0] as { to: string; subject: string; text: string };
    expect(mail.to).toBe(payload.email);
    const password = mail.text.match(/Contraseña temporal: (\S+)/)![1];
    expect(await verifyPassword(password, stored!.user!.password!)).toBe(true);
  });

  it('registra la acción en la auditoría con el Administrador como actor y nada cuando se rechaza', async () => {
    const payload = body();

    await register(payload).expect(201);
    await register(body({ identification: payload.identification })).expect(409);

    const records = await prisma.auditLog.findMany({
      where: { userId: adminId, affectedRecord: { contains: payload.identification } },
    });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      role: 'Rol de prueba',
      action: 'Registrar',
      module: 'Usuarios',
      affectedRecord: `${payload.identification} - María López`,
    });
  });

  it('registra una sola cuenta con varios roles', async () => {
    const payload = body({ roles: [staffRole.name, secondStaffRole.name] });

    await register(payload).expect(201);

    const stored = await findByEmail(payload.email);
    expect(stored?.user?.userRoles.map((assignment) => assignment.roleId).sort()).toEqual([staffRole.id, secondStaffRole.id].sort());
  });

  it('agrega el rol a la cuenta de una cliente sin duplicar a la persona', async () => {
    const passwordHash = await hasher.hash('Cliente123');
    const { person, user } = await createAccount([clientRole], passwordHash);

    const response = await register(body({ identification: person.identification, email: newEmail(), roles: [staffRole.name] })).expect(201);

    expect(response.body.data).toMatchObject({ existingPerson: true, passwordAssigned: false, credentialsSent: false, email: person.email });
    expect(await prisma.person.count({ where: { identification: person.identification } })).toBe(1);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { userRoles: true } });
    expect(stored.userRoles.map((assignment) => assignment.roleId).sort()).toEqual([clientRole.id, staffRole.id].sort());
    expect(stored.password).toBe(passwordHash);
    expect(send).not.toHaveBeenCalled();
  });

  it('rechaza con 400 los campos obligatorios vacíos', async () => {
    const response = await register(body({ email: '', roles: [] })).expect(400);

    expect(response.body).toMatchObject({ message: 'Complete los campos obligatorios', code: 'USER_MISSING_FIELDS', errors: ['email', 'roles'] });
  });

  it('rechaza la cédula con formato inválido', async () => {
    const response = await register(body({ identification: '11045' })).expect(400);

    expect(response.body.message).toBe('La cédula debe tener 10 dígitos válidos');
  });

  it('rechaza la cédula de un usuario del personal con 409', async () => {
    const { person } = await createAccount([staffRole], 'hash');

    const response = await register(body({ identification: person.identification })).expect(409);

    expect(response.body).toMatchObject({ message: 'Número de cédula ya registrado', code: 'USER_IDENTIFICATION_TAKEN' });
  });

  it('rechaza el correo ya registrado sin importar mayúsculas', async () => {
    const { person } = await createAccount([clientRole]);

    const response = await register(body({ email: person.email.toUpperCase() })).expect(409);

    expect(response.body).toMatchObject({ message: 'El correo ya se encuentra registrado', code: 'USER_EMAIL_TAKEN' });
  });

  it('rechaza roles que no son del personal', async () => {
    for (const role of [clientRole.name, 'rol_inexistente']) {
      const response = await register(body({ roles: [role] })).expect(400);
      expect(response.body.message).toBe('Seleccione roles válidos del personal');
    }
  });

  it('mantiene la cuenta cuando falla el envío del correo', async () => {
    send.mockRejectedValue(new Error('SMTP caído'));
    const payload = body();

    const response = await register(payload).expect(201);

    expect(response.body.message).toBe('Usuario registrado, pero no se pudo enviar el correo. Verifique la dirección y reenvíe las credenciales');
    expect(response.body.data).toMatchObject({ passwordAssigned: true, credentialsSent: false });
    expect((await findByEmail(payload.email))?.user).not.toBeNull();
  });

  it('solo uno de dos registros simultáneos con la misma cédula se crea', async () => {
    const identification = newIdentification();

    const results = await Promise.all([
      register(body({ identification })),
      register(body({ identification })),
    ]);

    expect(results.map((result) => result.status).sort((a, b) => a - b)).toEqual([201, 409]);
    expect(await prisma.person.count({ where: { identification } })).toBe(1);
  });

  it('responde 403 al usuario sin el permiso y 401 sin sesión', async () => {
    const { user } = await createAccount([staffRole]);
    const token = await tokens.issue(user.id);

    const denied = await register(body(), token).expect(403);
    expect(denied.body.message).toBe('No tiene permisos para realizar esta acción');
    await register(body(), null).expect(401);
    await request(app.getHttpServer()).get('/users/assignable-roles').set('Authorization', `Bearer ${token}`).expect(403);
  });

  it('niega el registro a una Recepcionista con el rol real del catálogo', async () => {
    const receptionist = await prisma.role.findUniqueOrThrow({ where: { name: 'receptionist' } });
    const { user } = await createAccount([receptionist]);

    const response = await register(body(), await tokens.issue(user.id)).expect(403);

    expect(response.body.message).toBe('No tiene permisos para realizar esta acción');
  });

  it('lista los roles asignables del personal sin el rol de cliente', async () => {
    const response = await request(app.getHttpServer())
      .get('/users/assignable-roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const names = (response.body.data as { name: string }[]).map((role) => role.name);
    expect(names).toContain(staffRole.name);
    expect(names).not.toContain(clientRole.name);
    expect(names).not.toContain('client');
  });
});
