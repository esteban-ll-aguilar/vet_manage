type RoleName =
  | 'superadmin'
  | 'manager'
  | 'veterinarian'
  | 'veterinary_technician'
  | 'receptionist'
  | 'cashier'
  | 'warehouse_keeper'
  | 'client';

type DemoUser = {
  identification: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  roles: readonly RoleName[];
  status?: 'ACTIVE' | 'INACTIVE';
  mustChangePassword?: boolean;
};

type IdentitySeedClient = {
  role: {
    findMany(args: {
      where: { name: { in: string[] } };
      select: { id: true; name: true };
    }): Promise<{ id: string; name: string }[]>;
  };
  $transaction<T>(
    callback: (transaction: IdentitySeedTransaction) => Promise<T>,
  ): Promise<T>;
};

type IdentitySeedTransaction = {
  person: {
    upsert(args: {
      where: { email: string };
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    }): Promise<{ id: string }>;
  };
  user: {
    upsert(args: {
      where: { personId: string };
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    }): Promise<{ id: string }>;
  };
  userRole: {
    deleteMany(args: {
      where: { userId: string; roleId: { notIn: string[] } };
    }): Promise<unknown>;
    findFirst(args: {
      where: { userId: string; roleId: string };
    }): Promise<{ id: string } | null>;
    create(args: {
      data: { userId: string; roleId: string };
    }): Promise<unknown>;
  };
};

// Contraseña común de las cuentas demo; cumple la política de formato.
export const DEMO_PASSWORD = 'Vet12345';

// No incluye al Administrador: lo crea la API al arrancar con las variables ADMIN_*.
export const IDENTITY_DEMO: { users: readonly DemoUser[] } = {
  users: [
    // Cuenta exclusiva para pruebas manuales; no representa un usuario operativo.
    {
      identification: '1700000019',
      firstName: 'Super',
      lastName: 'Administrador',
      email: 'superadmin@vetmanage.local',
      roles: ['superadmin'],
    },
    {
      identification: '1710000017',
      firstName: 'Marcelo',
      lastName: 'Paredes',
      email: 'gerente@vetmanage.local',
      phone: '0991000101',
      roles: ['manager'],
    },
    {
      identification: '1710000025',
      firstName: 'Valentina',
      lastName: 'Ruiz',
      email: 'veterinario@vetmanage.local',
      phone: '0991000102',
      roles: ['veterinarian'],
    },
    {
      identification: '1710000033',
      firstName: 'Diego',
      lastName: 'Reyes',
      email: 'veterinario2@vetmanage.local',
      phone: '0991000103',
      roles: ['veterinarian'],
    },
    {
      identification: '1710000041',
      firstName: 'Camila',
      lastName: 'Andrade',
      email: 'tecnico@vetmanage.local',
      phone: '0991000104',
      roles: ['veterinary_technician'],
    },
    {
      identification: '1710000058',
      firstName: 'Lucía',
      lastName: 'Mendoza',
      email: 'recepcion@vetmanage.local',
      phone: '0991000105',
      roles: ['receptionist'],
    },
    {
      identification: '1710000066',
      firstName: 'Andrés',
      lastName: 'Vera',
      email: 'cajero@vetmanage.local',
      phone: '0991000106',
      roles: ['cashier'],
    },
    {
      identification: '1710000074',
      firstName: 'Pablo',
      lastName: 'Cedeño',
      email: 'bodeguero@vetmanage.local',
      phone: '0991000107',
      roles: ['warehouse_keeper'],
    },
    {
      identification: '1710000082',
      firstName: 'Sofía',
      lastName: 'Herrera',
      email: 'cliente@vetmanage.local',
      phone: '0991000108',
      roles: ['client'],
    },
    // Usuario con varios roles.
    {
      identification: '1710000090',
      firstName: 'Jorge',
      lastName: 'Solís',
      email: 'gerente.veterinario@vetmanage.local',
      roles: ['manager', 'veterinarian'],
    },
    // Cuenta inactiva: no puede iniciar sesión.
    {
      identification: '1710000108',
      firstName: 'Rafael',
      lastName: 'Cruz',
      email: 'inactivo@vetmanage.local',
      roles: ['receptionist'],
      status: 'INACTIVE',
    },
    // Contraseña temporal: el sistema debe pedir el cambio en el primer ingreso.
    {
      identification: '1710000116',
      firstName: 'Elena',
      lastName: 'Torres',
      email: 'temporal@vetmanage.local',
      roles: ['receptionist'],
      mustChangePassword: true,
    },
  ],
};

type SeedOptions = {
  hashPassword: (password: string) => Promise<string>;
  // Tiempo máximo de espera a que la API cree los roles del sistema.
  rolesTimeoutMs?: number;
  pollMs?: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Los roles los crea la API al arrancar; se espera a que existan antes de asignarlos.
async function loadRoles(
  prisma: IdentitySeedClient,
  names: string[],
  timeoutMs: number,
  pollMs: number,
) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const roles = await prisma.role.findMany({
      where: { name: { in: names } },
      select: { id: true, name: true },
    });
    const missing = names.filter(
      (name) => !roles.some((role) => role.name === name),
    );
    if (missing.length === 0)
      return new Map(roles.map((role) => [role.name, role.id]));
    if (Date.now() >= deadline) {
      throw new Error(
        `Faltan roles en la base (${missing.join(', ')}). Inicie la API una vez para crearlos y repita el seed.`,
      );
    }
    await sleep(pollMs);
  }
}

export async function seedIdentity(
  prisma: IdentitySeedClient,
  options: SeedOptions,
) {
  const roleNames = [
    ...new Set(IDENTITY_DEMO.users.flatMap((user) => user.roles)),
  ];
  const roleIds = await loadRoles(
    prisma,
    roleNames,
    options.rolesTimeoutMs ?? 60_000,
    options.pollMs ?? 2_000,
  );
  const password = await options.hashPassword(DEMO_PASSWORD);

  return prisma.$transaction(async (tx) => {
    let assignments = 0;
    for (const demo of IDENTITY_DEMO.users) {
      const person = await tx.person.upsert({
        where: { email: demo.email },
        update: {
          identification: demo.identification,
          firstName: demo.firstName,
          lastName: demo.lastName,
          phone: demo.phone ?? null,
        },
        create: {
          identification: demo.identification,
          firstName: demo.firstName,
          lastName: demo.lastName,
          email: demo.email,
          phone: demo.phone ?? null,
        },
      });

      // Repetir el seed restaura la cuenta: contraseña, estado y bloqueo.
      const account = {
        password,
        status: demo.status ?? 'ACTIVE',
        mustChangePassword: demo.mustChangePassword ?? false,
        failedLoginAttempts: 0,
        isLocked: false,
        lockedAt: null,
      };
      const user = await tx.user.upsert({
        where: { personId: person.id },
        update: account,
        create: { personId: person.id, ...account },
      });

      const wanted = demo.roles.map((name) => roleIds.get(name) as string);
      await tx.userRole.deleteMany({
        where: { userId: user.id, roleId: { notIn: wanted } },
      });
      for (const roleId of wanted) {
        if (
          !(await tx.userRole.findFirst({ where: { userId: user.id, roleId } }))
        ) {
          await tx.userRole.create({ data: { userId: user.id, roleId } });
        }
        assignments++;
      }
    }
    return { users: IDENTITY_DEMO.users.length, assignments };
  });
}
