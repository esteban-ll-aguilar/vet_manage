type Hu23SeedClient = {
  $transaction<T>(callback: (transaction: Hu23SeedTransaction) => Promise<T>): Promise<T>;
};

type Hu23SeedTransaction = {
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
    upsert(args: {
      where: { code: string };
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    }): Promise<{ id: string }>;
  };
};

export const HU23_IVA_DEMO = {
  categories: [
    { name: 'Accesorios', description: 'Accesorios para cuidado y paseo.', vatRate: '12' },
    { name: 'Medicina', description: 'Medicamentos y tratamientos veterinarios.', vatRate: '0' },
    { name: 'Alimentos', description: 'Alimentos y nutrición para mascotas.', vatRate: '12' },
  ],
  brands: [
    { name: 'Kong', description: 'Juguetes y accesorios de enriquecimiento.' },
    { name: 'Zoetis', description: 'Productos y medicamentos veterinarios.' },
  ],
  products: [
    {
      code: 'PR-HU23-001',
      name: 'Collar para perro',
      description: 'Collar ajustable para paseos diarios.',
      unitPrice: '20.00',
      category: 'Accesorios',
      brand: 'Kong',
    },
    {
      code: 'PR-HU23-002',
      name: 'Vitaminas Caninas',
      description: 'Suplemento vitamínico para perros.',
      unitPrice: '10.00',
      category: 'Medicina',
      brand: 'Zoetis',
    },
  ],
} as const;

export async function seedHu23Iva(prisma: Hu23SeedClient) {
  return prisma.$transaction(async (tx) => {
    const categories = new Map<string, string>();

    for (const definition of HU23_IVA_DEMO.categories) {
      const category = await tx.category.upsert({
        where: { name: definition.name },
        update: {
          description: definition.description,
          vatRate: definition.vatRate,
          isActive: true,
        },
        create: {
          name: definition.name,
          description: definition.description,
          vatRate: definition.vatRate,
          isActive: true,
        },
      });
      categories.set(definition.name, category.id);
    }

    const brands = new Map<string, string>();
    for (const definition of HU23_IVA_DEMO.brands) {
      const brand = await tx.marca.upsert({
        where: { name: definition.name },
        update: { description: definition.description, isActive: true },
        create: { ...definition, isActive: true },
      });
      brands.set(definition.name, brand.id);
    }

    for (const definition of HU23_IVA_DEMO.products) {
      const categoryId = categories.get(definition.category);
      const brandId = brands.get(definition.brand);
      if (!categoryId || !brandId) {
        throw new Error(`Referencia de seed HU-23 no encontrada para ${definition.code}`);
      }

      await tx.product.upsert({
        where: { code: definition.code },
        update: {
          name: definition.name,
          description: definition.description,
          unitPrice: definition.unitPrice,
          categoryId,
          brandId,
          isActive: true,
        },
        create: {
          code: definition.code,
          name: definition.name,
          description: definition.description,
          unitPrice: definition.unitPrice,
          categoryId,
          brandId,
          isActive: true,
        },
      });
    }

    return {
      categories: HU23_IVA_DEMO.categories.length,
      brands: HU23_IVA_DEMO.brands.length,
      products: HU23_IVA_DEMO.products.length,
    };
  });
}
