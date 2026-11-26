import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobalExceptionFilter } from '../../src/common/errors/global-exception.filter.js';
import configuration from '../../src/config/configuration.js';
import { ROLES } from '../../src/config/roles.catalog.js';
import { PrismaModule } from '../../src/infrastructure/database/prisma/prisma.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { MailService } from '../../src/infrastructure/mail/mail.service.js';
import { IdentityModule } from '../../src/modules/identity/identity.module.js';
import { PasswordHasher } from '../../src/modules/identity/services/password-hasher.service.js';
import { TokenService } from '../../src/modules/identity/services/token.service.js';
import { deleteAuditLogsOfPeople } from './support.js';

const EMAIL_DOMAIN = '@e2e-userupdate.test';
const PASSWORD = 'Clave12345';
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';
let counter = 0;

const newIdentification = () => `96${`${Date.now()}${counter++}`.slice(-8)}`;
const newEmail = (prefix = 'uu') => `${prefix}.${Date.now()}.${counter++}${EMAIL_DOMAIN}`;
const permissionsOf = (role: string) => ROLES.find((item) => item.name === role)?.permissions ?? [];

describe('Actualizar datos de usuario (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  let passwordHash: string;
  let adminToken: string;
  const tokensByRole = new Map<string, string>();
  const roleIds: string[] = [];
  const personIds: string[] = [];
  const mail = { send: vi.fn(async (_message: { to: string; subject: string; text: string }) => undefined) };

  // Rol de prueba con los permisos que el catálogo da al rol real, para no depender de los datos del seed.
  async function createRoleLike(role: string) {
    const created = await prisma.role.create({
      data: { name: `test_uu_${role}_${Date.now()}_${counter++}`, displayName: `UU ${role}`, category: 'STAFF', isActive: true },
    });
    roleIds.push(created.id);
    for (const key of permissionsOf(role)) {
      const [module, action] = key.split(':');
      const permission = await prisma.permission.upsert({
        where: { permission_module_action_key: { module, action } },
        update: { isActive: true },
        create: { module, action, displayName: key, isActive: true },
      });
      await prisma.rolePermission.create({ data: { roleId: created.id, permissionId: permission.id } });
    }
    return created.id;
  }

  async function createUser(options: { status?: 'ACTIVE' | 'INACTIVE' | 'DEACTIVATED'; roleId?: string; phone?: string } = {}) {
    const person = await prisma.person.create({
      data: {
        identification: newIdentification(),
        firstName: 'Carlos',
        lastName: 'Pérez',
        email: newEmail(),
        phone: options.phone ?? '0991111111',
      },
    });
    personIds.push(person.id);
    const user = await prisma.user.create({
      data: { personId: person.id, status: options.status ?? 'ACTIVE', password: passwordHash, mustChangePassword: false },
    });
    if (options.roleId) await prisma.userRole.create({ data: { userId: user.id, roleId: options.roleId } });
    return { id: user.id, person };
  }

  const getUser = (id: string, token: string | null = adminToken) => {
    const call = request(app.getHttpServer()).get(`/users/${id}`);
    return token ? call.set('Authorization', `Bearer ${token}`) : call;
  };
  const patchUser = (id: string, body: object, token: string | null = adminToken) => {
    const call = request(app.getHttpServer()).patch(`/users/${id}`).send(body);
    return token ? call.set('Authorization', `Bearer ${token}`) : call;
  };
  const contact = (person: { firstName: string; lastName: string; email: string }, overrides: object = {}) => ({
    firstName: person.firstName,
    lastName: person.lastName,
    email: person.email,
    phone: '0992222222',
    ...overrides,
  });

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, load: [configuration] }), PrismaModule, IdentityModule],
    })
      .overrideProvider(MailService)
      .useValue(mail)
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    prisma = app.get(PrismaService);
    tokens = app.get(TokenService);
    passwordHash = await app.get(PasswordHasher).hash(PASSWORD);

    const admin = await createUser({ roleId: await createRoleLike('administrator') });
    adminToken = await tokens.issue(admin.id);
    for (const role of ['manager', 'veterinarian', 'veterinary_technician', 'receptionist', 'cashier', 'warehouse_keeper']) {
      const user = await createUser({ roleId: await createRoleLike(role) });
      tokensByRole.set(role, await tokens.issue(user.id));
    }
  });

  afterAll(async () => {
    if (!prisma) return;
    await deleteAuditLogsOfPeople(prisma, personIds);
    await prisma.userSession.deleteMany({ where: { user: { personId: { in: personIds } } } });
    await prisma.userRole.deleteMany({ where: { user: { personId: { in: personIds } } } });
    await prisma.user.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
    await prisma.rolePermission.deleteMany({ where: { roleId: { in: roleIds } } });
    await prisma.role.deleteMany({ where: { id: { in: roleIds } } });
    await app.close();
  });

  beforeEach(() => {
    mail.send.mockClear();
    mail.send.mockResolvedValue(undefined);
  });

  describe('GET /users/:id', () => {
    it('devuelve los datos del usuario con su teléfono (200)', async () => {
      const { id, person } = await createUser();

      const response = await getUser(id).expect(200);

      expect(response.body.data).toMatchObject({
        id,
        identification: person.identification,
        firstName: 'Carlos',
        email: person.email,
        phone: '0991111111',
        status: 'ACTIVE',
      });
    });

    it('responde 404 si no existe y 400 con un identificador mal formado', async () => {
      const missing = await getUser(UNKNOWN_ID).expect(404);
      expect(missing.body.message).toBe('Usuario no encontrado');

      await getUser('abc').expect(400);
    });

    it('exige sesión (401)', async () => {
      const { id } = await createUser();
      await getUser(id, null).expect(401);
    });

    // Matriz de roles, sección 2.1: solo el Administrador consulta usuarios.
    it('rechaza a un rol sin users:read (403)', async () => {
      const { id } = await createUser();

      const response = await getUser(id, tokensByRole.get('cashier')).expect(403);

      expect(response.body.message).toBe('No tiene permisos para realizar esta acción');
    });
  });

  describe('PATCH /users/:id', () => {
    it('actualiza el teléfono, audita el cambio y responde el mensaje de la HU (200)', async () => {
      const { id, person } = await createUser();

      const response = await patchUser(id, contact(person)).expect(200);

      expect(response.body.message).toBe('Datos actualizados correctamente');
      expect(response.body.data).toMatchObject({ id, phone: '0992222222', identification: person.identification, noticeSent: null });
      const log = await prisma.auditLog.findFirst({
        where: { module: 'Usuarios', action: 'Actualizar', affectedRecord: { startsWith: person.identification } },
        orderBy: { occurredAt: 'desc' },
      });
      expect(log?.previousValue).toEqual({ phone: '0991111111' });
      expect(log?.newValue).toEqual({ phone: '0992222222' });
      expect(mail.send).not.toHaveBeenCalled();
    });

    it('ignora la cédula enviada y actualiza un usuario inactivo', async () => {
      const { id, person } = await createUser({ status: 'INACTIVE' });

      const response = await patchUser(id, contact(person, { identification: '0102030405' })).expect(200);

      expect(response.body.data.identification).toBe(person.identification);
      expect(response.body.data.status).toBe('INACTIVE');
    });

    it('cambia el correo: avisa al anterior y el usuario inicia sesión con el nuevo', async () => {
      const { id, person } = await createUser();
      const nextEmail = newEmail('nuevo');

      const response = await patchUser(id, contact(person, { email: nextEmail.toUpperCase() })).expect(200);

      expect(response.body.data).toMatchObject({ email: nextEmail, noticeSent: true });
      expect(mail.send).toHaveBeenCalledTimes(1);
      expect(mail.send.mock.calls[0][0].to).toBe(person.email);
      await request(app.getHttpServer()).post('/auth/login').send({ email: nextEmail, password: PASSWORD }).expect(200);
      await request(app.getHttpServer()).post('/auth/login').send({ email: person.email, password: PASSWORD }).expect(401);
    });

    it('conserva el cambio de correo si falla el aviso', async () => {
      mail.send.mockRejectedValue(new Error('SMTP caído'));
      const { id, person } = await createUser();
      const nextEmail = newEmail('sinaviso');

      const response = await patchUser(id, contact(person, { email: nextEmail })).expect(200);

      expect(response.body.message).toBe('Datos actualizados correctamente');
      expect(response.body.data.noticeSent).toBe(false);
      const stored = await prisma.person.findUnique({ where: { id: person.id } });
      expect(stored?.email).toBe(nextEmail);
    });

    it('rechaza el correo de otro usuario (409)', async () => {
      const { id, person } = await createUser();
      const other = await createUser();

      const response = await patchUser(id, contact(person, { email: other.person.email.toUpperCase() })).expect(409);

      expect(response.body.message).toBe('El correo ya se encuentra registrado');
      expect(response.body.errors).toEqual(['email']);
    });

    it('rechaza un obligatorio vacío (400)', async () => {
      const { id, person } = await createUser();

      const response = await patchUser(id, contact(person, { firstName: '' })).expect(400);

      expect(response.body.message).toBe('Complete los campos obligatorios');
      expect(response.body.errors).toEqual(['firstName']);
    });

    it.each([[{ email: 'carlos@' }, 'email'], [{ phone: '0991' }, 'phone']])('rechaza el formato de %j (400)', async (override, field) => {
      const { id, person } = await createUser();

      const response = await patchUser(id, contact(person, override)).expect(400);

      expect(response.body.message).toBe('Formato no válido');
      expect(response.body.errors).toEqual([field]);
    });

    it('rechaza campos que no son editables y un identificador mal formado (400)', async () => {
      const { id, person } = await createUser();

      await patchUser(id, contact(person, { status: 'DEACTIVATED' })).expect(400);
      await patchUser('abc', contact(person)).expect(400);
    });

    it('responde 404 si el usuario no existe', async () => {
      const { person } = await createUser();

      const response = await patchUser(UNKNOWN_ID, contact(person)).expect(404);

      expect(response.body.message).toBe('Usuario no encontrado');
    });

    it('rechaza un usuario dado de baja sin cambiar sus datos (409)', async () => {
      const { id, person } = await createUser({ status: 'DEACTIVATED' });

      const response = await patchUser(id, contact(person)).expect(409);

      expect(response.body.message).toBe('No se puede actualizar un usuario dado de baja');
      const stored = await prisma.person.findUnique({ where: { id: person.id } });
      expect(stored?.phone).toBe('0991111111');
    });

    it('exige sesión (401)', async () => {
      const { id, person } = await createUser();
      await patchUser(id, contact(person), null).expect(401);
    });

    // Matriz de roles, sección 2.1: solo el Administrador actualiza datos de usuario.
    it.each(['manager', 'veterinarian', 'veterinary_technician', 'receptionist', 'cashier', 'warehouse_keeper'])(
      'rechaza a %s (403)',
      async (role) => {
        const { id, person } = await createUser();

        const response = await patchUser(id, contact(person), tokensByRole.get(role)).expect(403);

        expect(response.body.message).toBe('No tiene permisos para realizar esta acción');
        const stored = await prisma.person.findUnique({ where: { id: person.id } });
        expect(stored?.phone).toBe('0991111111');
      },
    );
  });
});
