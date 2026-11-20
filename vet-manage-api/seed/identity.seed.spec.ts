import { describe, expect, it, vi } from 'vitest';
import {
  hashPassword,
  verifyPassword,
} from '../src/common/security/password-hash.js';
import { isValidPassword } from '../src/common/security/password-policy.js';
import { isValidIdentification } from '../src/common/validation/identification.js';
import { DEMO_PASSWORD, IDENTITY_DEMO, seedIdentity } from './identity.seed.js';

const ROLE_NAMES = [
  'superadmin',
  'manager',
  'veterinarian',
  'veterinary_technician',
  'receptionist',
  'cashier',
  'warehouse_keeper',
  'client',
];

function createPrismaMock(existingRoles = ROLE_NAMES) {
  const tx = {
    person: {
      upsert: vi.fn(
        async ({ create }: { create: { identification: string } }) => ({
          id: `person-${create.identification}`,
        }),
      ),
    },
    user: {
      upsert: vi.fn(
        async ({
          where,
        }: {
          where: { personId: string };
          update?: Record<string, unknown>;
        }) => ({ id: `user-${where.personId}` }),
      ),
    },
    userRole: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
      findFirst: vi.fn(async (): Promise<{ id: string } | null> => null),
      create: vi.fn(async () => ({})),
    },
  };
  const prisma = {
    role: {
      findMany: vi.fn(async () =>
        existingRoles.map((name) => ({ id: `role-${name}`, name })),
      ),
    },
    $transaction: vi.fn((callback: (transaction: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  return { tx, prisma };
}

const options = {
  hashPassword: async () => 'hash',
  rolesTimeoutMs: 0,
  pollMs: 0,
};

describe('Identity demo seed', () => {
  it('declares unique identifications and emails, and valid role names', () => {
    const { users } = IDENTITY_DEMO;

    expect(new Set(users.map((user) => user.identification)).size).toBe(
      users.length,
    );
    expect(new Set(users.map((user) => user.email)).size).toBe(users.length);
    expect(
      users.every((user) => isValidIdentification(user.identification)),
    ).toBe(true);
    expect(
      users.every(
        (user) =>
          user.roles.length > 0 &&
          user.roles.every((role) => ROLE_NAMES.includes(role)),
      ),
    ).toBe(true);
  });

  it('covers every non-administrator role and the login edge cases', () => {
    const { users } = IDENTITY_DEMO;

    expect(new Set(users.flatMap((user) => user.roles))).toEqual(
      new Set(ROLE_NAMES),
    );
    expect(users.some((user) => user.roles.length > 1)).toBe(true);
    expect(users.some((user) => user.status === 'INACTIVE')).toBe(true);
    expect(users.some((user) => user.mustChangePassword)).toBe(true);
    expect(
      users.every(
        (user) => !(user.roles as readonly string[]).includes('administrator'),
      ),
    ).toBe(true);
  });

  it('uses a password that follows the format policy and verifies against its hash', async () => {
    expect(isValidPassword(DEMO_PASSWORD)).toBe(true);
    expect(
      await verifyPassword(DEMO_PASSWORD, await hashPassword(DEMO_PASSWORD)),
    ).toBe(true);
  });

  it('upserts people and accounts by natural key and assigns the declared roles', async () => {
    const { prisma, tx } = createPrismaMock();

    const result = await seedIdentity(prisma as never, options);

    const expectedAssignments = IDENTITY_DEMO.users.reduce(
      (total, user) => total + user.roles.length,
      0,
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.person.upsert).toHaveBeenCalledTimes(IDENTITY_DEMO.users.length);
    expect(tx.user.upsert).toHaveBeenCalledTimes(IDENTITY_DEMO.users.length);
    expect(tx.userRole.create).toHaveBeenCalledTimes(expectedAssignments);
    expect(result).toEqual({
      users: IDENTITY_DEMO.users.length,
      assignments: expectedAssignments,
    });
  });

  it('restores password, status and lock on repeated runs', async () => {
    const { prisma, tx } = createPrismaMock();

    await seedIdentity(prisma as never, options);

    expect(tx.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          password: 'hash',
          status: 'ACTIVE',
          failedLoginAttempts: 0,
          isLocked: false,
          lockedAt: null,
        }),
      }),
    );
    const inactive = IDENTITY_DEMO.users.findIndex(
      (user) => user.status === 'INACTIVE',
    );
    expect(tx.user.upsert.mock.calls[inactive][0].update).toMatchObject({
      status: 'INACTIVE',
    });
  });

  it('does not duplicate role assignments that already exist', async () => {
    const { prisma, tx } = createPrismaMock();
    tx.userRole.findFirst.mockResolvedValue({ id: 'existing' });

    await seedIdentity(prisma as never, options);

    expect(tx.userRole.create).not.toHaveBeenCalled();
  });

  it('fails with a clear message when the system roles do not exist yet', async () => {
    const { prisma } = createPrismaMock(['manager']);

    await expect(seedIdentity(prisma as never, options)).rejects.toThrow(
      /Faltan roles.*veterinarian/,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
