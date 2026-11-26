type Hu30SeedClient = {
  $transaction<T>(callback: (transaction: Hu30SeedTransaction) => Promise<T>): Promise<T>;
};

type Hu30SeedTransaction = {
  person: {
    findUnique(args: {
      where: { email: string };
      include: { user: { select: { id: true } } };
    }): Promise<{ user: { id: string } | null } | null>;
  };
  category: {
    upsert(args: {
      where: { name: string };
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    }): Promise<{ id: string }>;
  };
  marca: {
    upsert(args: {
      where: { name: string };
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    }): Promise<{ id: string }>;
  };
  product: {
    findFirst(args: { where: { name: string } }): Promise<{ id: string } | null>;
    upsert(args: {
      where: { code: string };
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    }): Promise<{ id: string }>;
  };
  batch: {
    findFirst(args: { where: { code: string } }): Promise<{ id: string } | null>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<{ id: string }>;
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
  };
  notificationType: {
    upsert(args: {
      where: { code: string };
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    }): Promise<{ id: string }>;
  };
  notification: {
    upsert(args: {
      where: { id: string };
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    }): Promise<{ id: string }>;
  };
};

export const HU30_NOTIFICATIONS_DEMO = {
  lotIds: {
    LOT101: '11111111-1111-4111-8111-111111111101',
    LOT102: '11111111-1111-4111-8111-111111111102',
    LOT103: '11111111-1111-4111-8111-111111111103',
    LOT104: '11111111-1111-4111-8111-111111111104',
    LOT105: '11111111-1111-4111-8111-111111111105',
  },
  notificationIds: {
    LOT101: '21111111-1111-4111-8111-111111111101',
    LOT102: '21111111-1111-4111-8111-111111111102',
    LOT103: '21111111-1111-4111-8111-111111111103',
    LOT104: '21111111-1111-4111-8111-111111111104',
    LOT105: '21111111-1111-4111-8111-111111111105',
    ANALGESICO: '21111111-1111-4111-8111-111111111106',
    LOT101_SECOND: '21111111-1111-4111-8111-111111111107',
  },
  products: [
    { code: 'PR-HU30-001', name: 'Antiparasitario', unitPrice: '18.75', category: 'Medicamentos', brand: 'Zoetis' },
    { code: 'PR-HU30-002', name: 'Analgésico', unitPrice: '8.50', category: 'Medicamentos', brand: 'Zoetis' },
    { code: 'PR-HU30-003', name: 'Antibiótico', unitPrice: '15.00', category: 'Medicamentos', brand: 'Zoetis' },
    { code: 'PR-HU30-004', name: 'Vitaminas', unitPrice: '10.00', category: 'Medicamentos', brand: 'Zoetis' },
    { code: 'PR-HU30-005', name: 'Suplemento', unitPrice: '12.00', category: 'Medicamentos', brand: 'Zoetis' },
  ],
  lots: [
    { code: 'LOT-101', product: 'Antiparasitario', quantity: 10, expirationDate: '2026-12-15' },
    { code: 'LOT-102', product: 'Vitaminas', quantity: 6, expirationDate: '2026-11-20' },
    { code: 'LOT-103', product: 'Antibiótico', quantity: 5, expirationDate: '2026-10-15' },
    { code: 'LOT-104', product: 'Antiparasitario', quantity: 12, expirationDate: '2026-12-20' },
    { code: 'LOT-105', product: 'Suplemento', quantity: 2, expirationDate: '2026-11-25' },
  ],
} as const;

export async function seedHu30Notifications(prisma: Hu30SeedClient) {
  return prisma.$transaction(async (tx) => {
    const gerente = await tx.person.findUnique({
      where: { email: 'gerente@vetmanage.local' },
      include: { user: { select: { id: true } } },
    });
    if (!gerente?.user) throw new Error('Usuario demo gerente@vetmanage.local no encontrado');

    const cajero = await tx.person.findUnique({
      where: { email: 'cajero@vetmanage.local' },
      include: { user: { select: { id: true } } },
    });
    if (!cajero?.user) throw new Error('Usuario demo cajero@vetmanage.local no encontrado');

    const categoria = await tx.category.upsert({
      where: { name: 'Medicamentos' },
      update: { description: 'Medicamentos y tratamientos veterinarios.', isActive: true },
      create: { name: 'Medicamentos', description: 'Medicamentos y tratamientos veterinarios.', isActive: true },
    });
    const marca = await tx.marca.upsert({
      where: { name: 'Zoetis' },
      update: { description: 'Productos y medicamentos veterinarios.', isActive: true },
      create: { name: 'Zoetis', description: 'Productos y medicamentos veterinarios.', isActive: true },
    });

    const productIds = new Map<string, string>();
    for (const definition of HU30_NOTIFICATIONS_DEMO.products) {
      const existing = await tx.product.findFirst({ where: { name: definition.name } });
      if (existing) {
        productIds.set(definition.name, existing.id);
        continue;
      }
      const product = await tx.product.upsert({
        where: { code: definition.code },
        update: {
          name: definition.name,
          description: `Producto demo HU-30: ${definition.name}.`,
          unitPrice: definition.unitPrice,
          categoryId: categoria.id,
          brandId: marca.id,
          isActive: true,
        },
        create: {
          code: definition.code,
          name: definition.name,
          description: `Producto demo HU-30: ${definition.name}.`,
          unitPrice: definition.unitPrice,
          categoryId: categoria.id,
          brandId: marca.id,
          isActive: true,
        },
      });
      productIds.set(definition.name, product.id);
    }

    const lotIds = new Map<string, string>();
    for (const definition of HU30_NOTIFICATIONS_DEMO.lots) {
      const product = await tx.product.findFirst({ where: { name: definition.product } });
      if (!product) throw new Error(`Producto demo HU-30 no encontrado: ${definition.product}`);

      const lot = await tx.batch.findFirst({ where: { code: definition.code } });
      const data = {
        productId: product.id,
        code: definition.code,
        expirationDate: new Date(`${definition.expirationDate}T00:00:00.000Z`),
        initialQuantity: definition.quantity,
        availableQuantity: definition.quantity,
      };

      const saved = lot
        ? await tx.batch.update({ where: { id: lot.id }, data })
        : await tx.batch.create({ data });
      lotIds.set(definition.code, saved.id);
    }

    const analgesico = await tx.product.findFirst({ where: { name: 'Analgésico' } });
    if (!analgesico) throw new Error('Producto demo Analgésico no encontrado');

    const type = await tx.notificationType.upsert({
      where: { code: 'INVENTORY_ALERT' },
      update: {
        name: 'Alerta de inventario',
        description: 'Aviso relacionado con lotes o productos.',
        rolesDestino: ['manager', 'cashier', 'warehouse_keeper'],
        isActive: true,
      },
      create: {
        code: 'INVENTORY_ALERT',
        name: 'Alerta de inventario',
        description: 'Aviso relacionado con lotes o productos.',
        rolesDestino: ['manager', 'cashier', 'warehouse_keeper'],
        isActive: true,
      },
    });

    const notifications = [
      {
        id: HU30_NOTIFICATIONS_DEMO.notificationIds.LOT101,
        titulo: 'Lote próximo a caducar',
        mensaje: 'El lote LOT-101 del producto Antiparasitario tiene 10 unidades y caduca dentro de 30 días',
        detalle: 'El lote LOT-101 del producto Antiparasitario tiene 10 unidades y caduca dentro de 30 días',
        tipoEntidad: 'BATCH',
        entidadId: lotIds.get('LOT-101')!,
        fechaEmitida: new Date('2026-11-15T09:30:00.000Z'),
        leida: false,
      },
      {
        id: HU30_NOTIFICATIONS_DEMO.notificationIds.ANALGESICO,
        titulo: 'Stock mínimo alcanzado',
        mensaje: 'El producto Analgésico tiene 3 unidades disponibles',
        detalle: 'El producto Analgésico tiene 3 unidades disponibles',
        tipoEntidad: 'PRODUCT',
        entidadId: analgesico.id,
        fechaEmitida: new Date('2026-11-15T10:00:00.000Z'),
        leida: true,
      },
      {
        id: HU30_NOTIFICATIONS_DEMO.notificationIds.LOT102,
        titulo: 'Lote próximo a caducar',
        mensaje: 'El lote LOT-102 del producto Vitaminas tiene 6 unidades y caduca dentro de 5 días',
        detalle: 'El lote LOT-102 del producto Vitaminas tiene 6 unidades y caduca dentro de 5 días',
        tipoEntidad: 'BATCH',
        entidadId: lotIds.get('LOT-102')!,
        fechaEmitida: new Date('2026-11-15T11:15:00.000Z'),
        leida: false,
      },
      {
        id: HU30_NOTIFICATIONS_DEMO.notificationIds.LOT103,
        titulo: 'Lote caducado',
        mensaje: 'El lote LOT-103 del producto Antibiótico tiene 5 unidades disponibles y está caducado',
        detalle: 'El lote LOT-103 del producto Antibiótico tiene 5 unidades disponibles y está caducado',
        tipoEntidad: 'BATCH',
        entidadId: lotIds.get('LOT-103')!,
        fechaEmitida: new Date('2026-11-15T12:00:00.000Z'),
        leida: false,
      },
      {
        id: HU30_NOTIFICATIONS_DEMO.notificationIds.LOT104,
        titulo: 'Lote próximo a caducar',
        mensaje: 'El lote LOT-104 del producto Antiparasitario tiene 12 unidades y caduca dentro de 25 días',
        detalle: 'El lote LOT-104 del producto Antiparasitario tiene 12 unidades y caduca dentro de 25 días',
        tipoEntidad: 'BATCH',
        entidadId: lotIds.get('LOT-104')!,
        fechaEmitida: new Date('2026-11-15T13:00:00.000Z'),
        leida: false,
      },
      {
        id: HU30_NOTIFICATIONS_DEMO.notificationIds.LOT105,
        titulo: 'Lote próximo a caducar',
        mensaje: 'El lote LOT-105 del producto Suplemento tiene 2 unidades y caduca dentro de 10 días',
        detalle: 'El lote LOT-105 del producto Suplemento tiene 2 unidades y caduca dentro de 10 días',
        tipoEntidad: 'BATCH',
        entidadId: lotIds.get('LOT-105')!,
        fechaEmitida: new Date('2026-11-15T14:00:00.000Z'),
        leida: false,
      },
    ];

    for (const notification of notifications) {
      await tx.notification.upsert({
        where: { id: notification.id },
        update: {
          userId: gerente.user.id,
          typeId: type.id,
          tipoEntidad: notification.tipoEntidad,
          entidadId: notification.entidadId,
          titulo: notification.titulo,
          mensaje: notification.mensaje,
          detalle: notification.detalle,
          prioridad: 'MEDIA',
          fechaEmitida: notification.fechaEmitida,
          fechaLectura: notification.leida ? notification.fechaEmitida : null,
          leida: notification.leida,
        },
        create: {
          id: notification.id,
          userId: gerente.user.id,
          typeId: type.id,
          tipoEntidad: notification.tipoEntidad,
          entidadId: notification.entidadId,
          titulo: notification.titulo,
          mensaje: notification.mensaje,
          detalle: notification.detalle,
          prioridad: 'MEDIA',
          fechaEmitida: notification.fechaEmitida,
          fechaLectura: notification.leida ? notification.fechaEmitida : null,
          leida: notification.leida,
        },
      });
    }

    return {
      users: 2,
      products: HU30_NOTIFICATIONS_DEMO.products.length,
      lots: HU30_NOTIFICATIONS_DEMO.lots.length,
      notifications: notifications.length,
      emptyNotificationsUser: cajero.user.id,
    };
  });
}
