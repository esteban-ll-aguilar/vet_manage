import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobalExceptionFilter } from '../../src/common/errors/global-exception.filter.js';
import { identificationCheckDigit } from '../../src/common/validation/identification.js';
import configuration from '../../src/config/configuration.js';
import { PrismaModule } from '../../src/infrastructure/database/prisma/prisma.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma/prisma.service.js';
import { MailModule } from '../../src/infrastructure/mail/mail.module.js';
import { MailService } from '../../src/infrastructure/mail/mail.service.js';
import { IdentityModule } from '../../src/modules/identity/identity.module.js';
import { PasswordHasher } from '../../src/modules/identity/services/password-hasher.service.js';

const PASSWORD = 'Vet12345';
const EMAIL_DOMAIN = '@e2e-client-register.test';
const REAL_IDENTIFICATION = '1104913395';
const ALLOWED_ROLES = ['receptionist', 'veterinarian', 'manager'] as const;
const DENIED_ROLES = ['cashier', 'veterinary_technician', 'administrator'] as const;
type RoleName = (typeof ALLOWED_ROLES)[number] | (typeof DENIED_ROLES)[number];

const send = vi.fn();

describe('POST /clients (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordHash: string;
  let clientRoleId: string;
  let counter = 0;
  const tokens = new Map<RoleName, string>();
  const patientIds: string[] = [];
  let speciesId: string | null = null;
  let breedId: string | null = null;
  let realSnapshot:
    | {
      personId: string;
      userId: string;
      address: string | null;
      password: string | null;
      mustChangePassword: boolean;
      status: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string | null;
      hadClient: boolean;
      hadClientRole: boolean;
      createdByTest: boolean;
    }
    | null = null;

  function newIdentification() {
    const nine = `172${`${Date.now()}${counter++}`.slice(-6)}`;
    return `${nine}${identificationCheckDigit(nine)}`;
  }

  const newEmail = () => `register.${Date.now()}.${counter++}${EMAIL_DOMAIN}`;

  function body(overrides: Record<string, unknown> = {}) {
    return {
      identification: newIdentification(),
      firstName: 'María',
      lastName: 'López',
      email: newEmail(),
      phone: '0999999999',
      address: '',
      ...overrides,
    };
  }

  const post = (path: string, payload: object, token: string | null) => {
    const call = request(app.getHttpServer()).post(path).send(payload);
    return token ? call.set('Authorization', `Bearer ${token}`) : call;
  };

  async function loginAs(roleName: RoleName) {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    const person = await prisma.person.create({
      data: {
        identification: newIdentification(),
        firstName: `Acceso${roleName}`,
        lastName: 'Prueba',
        email: newEmail(),
      },
    });
    await prisma.user.create({
      data: {
        personId: person.id,
        password: passwordHash,
        userRoles: { create: { roleId: role.id } },
      },
    });

    const response = await post('/auth/login', { email: person.email, password: PASSWORD }, null).expect(200);
    tokens.set(roleName, response.body.data.accessToken as string);
  }

  async function registerAs(roleName: RoleName, overrides: Record<string, unknown> = {}) {
    const payload = body(overrides);
    const response = await post('/clients', payload, tokens.get(roleName) ?? null);
    return { payload, response };
  }

  async function deleteAuditLogs() {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`ALTER TABLE "audit_logs" DISABLE TRIGGER "audit_logs_read_only"`;
      try {
        await tx.$executeRaw`
          DELETE FROM "audit_logs"
          WHERE "user_id" IN (
            SELECT u."id"
            FROM "users" u
            JOIN "persons" p ON p."id" = u."person_id"
            WHERE p."email" LIKE ${`%${EMAIL_DOMAIN}`}
          )
        `;
      } finally {
        await tx.$executeRaw`ALTER TABLE "audit_logs" ENABLE TRIGGER "audit_logs_read_only"`;
      }
    });
  }

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
        PrismaModule,
        MailModule,
        IdentityModule,
      ],
    })
      .overrideProvider(MailService)
      .useValue({ send })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    prisma = app.get(PrismaService);
    passwordHash = await app.get(PasswordHasher).hash(PASSWORD);

    const clientRole = await prisma.role.findUniqueOrThrow({ where: { name: 'client' } });
    clientRoleId = clientRole.id;

    for (const roleName of [...ALLOWED_ROLES, ...DENIED_ROLES]) {
      await loginAs(roleName);
    }
  });

  beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    if (!prisma) return;

    if (realSnapshot) {
      const { personId, userId, address, hadClient, hadClientRole, createdByTest } = realSnapshot;
      if (!hadClient) await prisma.client.deleteMany({ where: { personId } });
      if (!hadClientRole) await prisma.userRole.deleteMany({ where: { userId, roleId: clientRoleId } });
      await prisma.person.update({ where: { id: personId }, data: { address } });
      if (createdByTest) await prisma.user.deleteMany({ where: { id: userId } });
      if (createdByTest) await prisma.person.deleteMany({ where: { id: personId } });
    }

    const testPeople = await prisma.person.findMany({
      where: { email: { endsWith: EMAIL_DOMAIN } },
      select: { id: true },
    });
    const personIds = testPeople.map((person) => person.id);

    await deleteAuditLogs();
    await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
    if (breedId) await prisma.breed.deleteMany({ where: { id: breedId } });
    if (speciesId) await prisma.species.deleteMany({ where: { id: speciesId } });
    await prisma.userSession.deleteMany({ where: { user: { personId: { in: personIds } } } });
    await prisma.userRole.deleteMany({ where: { user: { personId: { in: personIds } } } });
    await prisma.client.deleteMany({ where: { person: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.user.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
    await app.close();
  });

  it('registra un cliente con teléfono obligatorio, dirección vacía y el mensaje contractual', async () => {
    const { payload, response } = await registerAs('receptionist');

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Cliente registrado exitosamente');
    expect(response.body.data).toMatchObject({
      identification: payload.identification,
      firstName: 'María',
      lastName: 'López',
      email: payload.email,
      phone: '0999999999',
      address: null,
      status: 'ACTIVE',
      existingPerson: false,
      passwordAssigned: true,
      credentialsSent: true,
      roles: [{ name: 'client', displayName: 'Cliente' }],
    });
    expect(response.body.data).not.toHaveProperty('password');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('permite el registro a Recepcionista, Veterinario y Gerente, y lo niega a los demás roles', async () => {
    for (const roleName of ALLOWED_ROLES) {
      const { response } = await registerAs(roleName);
      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Cliente registrado exitosamente');
    }

    const sendsAfterAllowed = send.mock.calls.length;
    for (const roleName of DENIED_ROLES) {
      const { response } = await registerAs(roleName);
      expect(response.status).toBe(403);
      expect(response.body.message).toBe('No tiene permisos para realizar esta acción');
    }
    expect(send).toHaveBeenCalledTimes(sendsAfterAllowed);
  });

  it('rechaza una cédula de cliente duplicada sin crear otro cliente ni alterar sus pacientes', async () => {
    const original = await registerAs('receptionist');
    expect(original.response.status).toBe(201);
    const personId = original.response.body.data.personId as string;
    const clientId = original.response.body.data.id as string;

    const species = await prisma.species.create({ data: { name: `E2E Specie ${Date.now()}` } });
    speciesId = species.id;
    const breed = await prisma.breed.create({ data: { name: 'E2E Breed', speciesId: species.id } });
    breedId = breed.id;
    const patient = await prisma.patient.create({
      data: {
        name: 'Firulais',
        gender: 'MALE',
        birthDate: new Date('2022-01-01'),
        weightKg: 12.5,
        heightCm: 45.3,
        reproductiveStatus: 'UNKNOWN',
        clientId,
        speciesId: species.id,
        breedId: breed.id,
      },
    });
    patientIds.push(patient.id);

    const duplicate = await registerAs('receptionist', {
      identification: original.payload.identification,
      email: newEmail(),
      phone: '0999999998',
    });

    expect(duplicate.response.status).toBe(409);
    expect(duplicate.response.body).toMatchObject({
      message: 'Número de cédula ya registrado',
      code: 'CLIENT_IDENTIFICATION_TAKEN',
    });
    const stored = await prisma.client.findUniqueOrThrow({
      where: { personId },
      include: { patients: true },
    });
    expect(stored.id).toBe(clientId);
    expect(stored.patients).toHaveLength(1);
    expect(stored.patients[0]).toMatchObject({ id: patient.id, name: 'Firulais' });
  });

  it('registra como cliente al personal 1104913395 reutilizando persona y cuenta sin cambiar contraseña ni enviar correo', async () => {
    let person = await prisma.person.findUnique({
      where: { identification: REAL_IDENTIFICATION },
      include: { user: { include: { userRoles: true } }, client: true },
    });
    let createdByTest = false;

    if (!person) {
      const role = await prisma.role.findUniqueOrThrow({ where: { name: 'receptionist' } });
      const email = newEmail();
      const created = await prisma.person.create({
        data: {
          identification: REAL_IDENTIFICATION,
          firstName: 'Leonardo',
          lastName: 'Peralta',
          email,
          user: { create: { password: passwordHash, userRoles: { create: { roleId: role.id } } } },
        },
        include: { user: { include: { userRoles: true } }, client: true },
      });
      person = created;
      createdByTest = true;
    }

    const user = person.user;
    expect(user).not.toBeNull();
    expect(person.client).toBeNull();
    const clientRoleAssignment = user!.userRoles.find((assignment) => assignment.roleId === clientRoleId);

    realSnapshot = {
      personId: person.id,
      userId: user!.id,
      address: person.address,
      password: user!.password,
      mustChangePassword: user!.mustChangePassword,
      status: user!.status,
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email,
      phone: person.phone,
      hadClient: Boolean(person.client),
      hadClientRole: Boolean(clientRoleAssignment),
      createdByTest,
    };

    const payload = body({
      identification: REAL_IDENTIFICATION,
      firstName: 'Nombre Nuevo',
      lastName: 'Apellido Nuevo',
      email: newEmail(),
      phone: '0999999997',
      address: '',
    });
    const response = await post('/clients', payload, tokens.get('receptionist') ?? null);

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Cliente registrado exitosamente');
    expect(response.body.data).toMatchObject({
      personId: person.id,
      identification: REAL_IDENTIFICATION,
      existingPerson: true,
      passwordAssigned: false,
      credentialsSent: false,
      roles: [{ name: 'client', displayName: 'Cliente' }],
    });

    const after = await prisma.person.findUniqueOrThrow({
      where: { id: person.id },
      include: { user: { include: { userRoles: true } }, client: true },
    });
    expect(after.id).toBe(realSnapshot.personId);
    expect(after.user?.id).toBe(realSnapshot.userId);
    expect(after.user?.password).toBe(realSnapshot.password);
    expect(after.user?.mustChangePassword).toBe(realSnapshot.mustChangePassword);
    expect(after.user?.status).toBe(realSnapshot.status);
    expect(after).toMatchObject({
      firstName: realSnapshot.firstName,
      lastName: realSnapshot.lastName,
      email: realSnapshot.email,
      phone: realSnapshot.phone,
      address: realSnapshot.address,
    });
    expect(after.user?.userRoles.some((assignment) => assignment.roleId === clientRoleId)).toBe(true);
    expect(after.client?.status).toBe('ACTIVE');
    expect(send).not.toHaveBeenCalled();
  });

  it('valora los mensajes exactos de campos obligatorios, cédula, correo y teléfono', async () => {
    const missing = await registerAs('receptionist', {
      identification: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
    });
    expect(missing.response.status).toBe(400);
    expect(missing.response.body).toMatchObject({
      message: 'Por favor, complete todos los campos obligatorios',
      code: 'CLIENT_MISSING_FIELDS',
      errors: ['identification', 'firstName', 'lastName', 'email', 'phone'],
    });

    const invalidIdentification = await registerAs('receptionist', { identification: '11045' });
    expect(invalidIdentification.response.status).toBe(400);
    expect(invalidIdentification.response.body).toMatchObject({
      message: 'Número de cédula no válido',
      code: 'CLIENT_INVALID_IDENTIFICATION',
      errors: ['identification'],
    });

    const invalidEmail = await registerAs('receptionist', { email: 'ana@' });
    expect(invalidEmail.response.status).toBe(400);
    expect(invalidEmail.response.body).toMatchObject({
      message: 'Por favor, ingrese un correo y número de teléfono válido',
      code: 'CLIENT_INVALID_EMAIL',
      errors: ['email'],
    });

    for (const phone of ['099123456', '09912345678', '0123456789', '+593991234567', '12ab']) {
      const invalidPhone = await registerAs('receptionist', { phone });
      expect(invalidPhone.response.status).toBe(400);
      expect(invalidPhone.response.body).toMatchObject({
        message: 'Por favor, ingrese un correo y número de teléfono válido',
        code: 'CLIENT_INVALID_PHONE',
        errors: ['phone'],
      });
    }
  });

  it('acepta una dirección de 255 caracteres y rechaza una de 256', async () => {
    const accepted = await registerAs('receptionist', { address: 'a'.repeat(255) });
    expect(accepted.response.status).toBe(201);
    expect(accepted.response.body.data.address).toBe('a'.repeat(255));

    const rejected = await registerAs('receptionist', { address: 'a'.repeat(256) });
    expect(rejected.response.status).toBe(400);
    expect(rejected.response.body).toMatchObject({
      message: 'Dirección no válida',
      code: 'CLIENT_INVALID_ADDRESS',
      errors: ['address'],
    });
  });
});
