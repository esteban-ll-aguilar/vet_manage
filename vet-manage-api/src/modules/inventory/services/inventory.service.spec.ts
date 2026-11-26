import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../generated/prisma/client.js';
import { ApiException } from '../../../common/errors/api-exception.js';
import { InventoryService } from './inventory.service.js';

function createCategoryVatPrismaMock(initial: Array<{
  id: string;
  name: string;
  isActive: boolean;
  vatRate: string | null;
}>) {
  const categories = initial.map((category) => ({
    ...category,
    description: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    vatRate: category.vatRate === null ? null : new Prisma.Decimal(category.vatRate),
  }));
  const category = {
    updateMany: vi.fn(async ({ where, data }: {
      where: { id: string; isActive: boolean };
      data: { vatRate: Prisma.Decimal };
    }) => {
      const target = categories.find((item) => item.id === where.id && item.isActive === where.isActive);
      if (!target) return { count: 0 };
      target.vatRate = data.vatRate;
      return { count: 1 };
    }),
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
      categories.find((item) => item.id === where.id) ?? null),
    findMany: vi.fn(async () => categories.filter((item) => item.isActive)),
  };
  const transaction = { category };

  return {
    categories,
    category,
    prisma: {
      category: { findMany: category.findMany },
      $transaction: vi.fn((callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction)),
    },
  };
}

function createPrismaMock() {
  const tx = {
    category: {
      upsert: vi.fn().mockResolvedValue({ id: 'category-1' }),
      findFirst: vi.fn().mockResolvedValue({ id: 'category-1', name: 'Alimentos' }),
      update: vi.fn().mockResolvedValue({ id: 'category-1', name: 'Nutrición', description: 'Nueva' }),
    },
    marca: {
      upsert: vi.fn().mockResolvedValue({ id: 'brand-1' }),
      findFirst: vi.fn().mockResolvedValue({ id: 'brand-1', name: 'Dog Chow' }),
      update: vi.fn().mockResolvedValue({ id: 'brand-1', name: 'Royal Canin', description: null }),
    },
    product: {
      create: vi.fn().mockResolvedValue({
        id: 'product-1', code: 'PR-001', name: 'Producto', description: null,
        unitPrice: new Prisma.Decimal('25.50'), category: { id: 'category-1', name: 'Alimentos' },
        brand: { id: 'brand-1', name: 'Dog Chow' }, createdAt: new Date('2026-01-01'),
      }),
      update: vi.fn().mockResolvedValue({
        id: 'product-1', code: 'PR-001', name: 'Producto actualizado', description: null,
        unitPrice: new Prisma.Decimal('30.00'), category: { id: 'category-1', name: 'Alimentos' },
        brand: { id: 'brand-1', name: 'Dog Chow' }, createdAt: new Date('2026-01-01'),
      }),
    },
  };
  return {
    tx,
    prisma: {
      $transaction: vi.fn((callback) => callback(tx)),
      category: {
        findUnique: vi.fn().mockResolvedValue({ id: 'category-1', name: 'Alimentos', isActive: true }),
        update: vi.fn().mockResolvedValue({ id: 'category-1', name: 'Nutrición', description: 'Nueva' }),
      },
      marca: {
        findUnique: vi.fn().mockResolvedValue({ id: 'brand-1', name: 'Dog Chow', isActive: true }),
        update: vi.fn().mockResolvedValue({ id: 'brand-1', name: 'Royal Canin', description: null }),
      },
      product: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue({
          id: 'product-1', code: 'PR-001', name: 'Producto', description: null,
          unitPrice: new Prisma.Decimal('25.50'), category: { id: 'category-1', name: 'Alimentos' },
          brand: { id: 'brand-1', name: 'Dog Chow' }, createdAt: new Date('2026-01-01'),
        }),
      },
    },
    batch: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
}

describe('InventoryService', () => {
  describe('búsqueda de productos (HU-10)', () => {
    it('lista los productos activos con el formato del catálogo cuando no hay filtros', async () => {
      const { prisma } = createPrismaMock();
      const product = { id: 'product-1', unitPrice: new Prisma.Decimal('25.50') };
      prisma.product.findMany.mockResolvedValue([product]);
      const service = new InventoryService(prisma as never);

      await expect(service.listProducts()).resolves.toEqual([{ ...product, unitPrice: '25.5' }]);
      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: { category: true, brand: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('admite la búsqueda existente por código o nombre de producto', async () => {
      const { prisma } = createPrismaMock();
      const service = new InventoryService(prisma as never);

      await service.listProducts({ search: ' PR-001 ' });

      expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          isActive: true,
          OR: [
            { code: { contains: 'PR-001', mode: 'insensitive' } },
            { name: { contains: 'PR-001', mode: 'insensitive' } },
            { category: { name: { contains: 'PR-001', mode: 'insensitive' } } },
            { brand: { name: { contains: 'PR-001', mode: 'insensitive' } } },
            { batches: { some: { code: { equals: 'PR-001', mode: 'insensitive' } } } },
          ],
        },
      }));
    });

    it.each(['L-2026-001', 'l-2026-001'])('busca el código completo del lote %s', async (batchCode) => {
      const { prisma } = createPrismaMock();
      const service = new InventoryService(prisma as never);

      await service.listProducts({ batchCode: ' ' + batchCode + ' ' });

      expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          isActive: true,
          batches: { some: { code: { equals: batchCode, mode: 'insensitive' } } },
        },
      }));
    });

    it.each(['Kong', 'KONG', 'kong'])('busca la marca %s sin distinguir mayúsculas', async (search) => {
      const { prisma } = createPrismaMock();
      const service = new InventoryService(prisma as never);

      await service.listProducts({ search });

      expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { brand: { name: { contains: search, mode: 'insensitive' } } },
          ]),
        }),
      }));
    });

    it.each([
      ['15', { gte: new Prisma.Decimal('15'), lt: new Prisma.Decimal('16') }],
      ['15.30', new Prisma.Decimal('15.30')],
    ])('busca el precio %s desde el campo general y desde el filtro de precio', async (precio, filtro) => {
      const { prisma } = createPrismaMock();
      const service = new InventoryService(prisma as never);

      await service.listProducts({ search: precio });
      expect(prisma.product.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([{ unitPrice: filtro }]),
        }),
      }));

      await service.listProducts({ unitPrice: precio });
      expect(prisma.product.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
        where: { isActive: true, unitPrice: filtro },
      }));
    });

    it.each([
      [{ name: ' Alimento ' }, { name: { contains: 'Alimento', mode: 'insensitive' } }],
      [{ categoryId: 'category-1' }, { categoryId: 'category-1' }],
      [{ brandId: 'brand-1' }, { brandId: 'brand-1' }],
      [{ brandName: ' Chow ' }, { brand: { name: { contains: 'Chow', mode: 'insensitive' } } }],
      [{ unitPrice: '25.50' }, { unitPrice: new Prisma.Decimal('25.50') }],
    ])('filtra productos activos mediante %j', async (consulta, filtro) => {
      const { prisma } = createPrismaMock();
      const service = new InventoryService(prisma as never);

      await service.listProducts(consulta);

      expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { isActive: true, ...filtro },
      }));
    });

    it('combina los criterios y devuelve una lista vacía cuando no hay coincidencias', async () => {
      const { prisma } = createPrismaMock();
      const service = new InventoryService(prisma as never);

      await expect(service.listProducts({
        name: 'Alimento',
        categoryId: 'category-1',
        brandId: 'brand-1',
        brandName: 'Chow',
        batchCode: 'L-2026-001',
        unitPrice: '25.50',
      })).resolves.toEqual([]);

      expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          isActive: true,
          name: { contains: 'Alimento', mode: 'insensitive' },
          categoryId: 'category-1',
          brandId: 'brand-1',
          brand: { name: { contains: 'Chow', mode: 'insensitive' } },
          batches: { some: { code: { equals: 'L-2026-001', mode: 'insensitive' } } },
          unitPrice: new Prisma.Decimal('25.50'),
        },
      }));
    });

    it('busca los caracteres comodín del nombre como texto literal', async () => {
      const { prisma } = createPrismaMock();
      const service = new InventoryService(prisma as never);

      await service.listProducts({ name: 'A_50%\\B' });

      expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { isActive: true, name: { contains: 'A\\_50\\%\\\\B', mode: 'insensitive' } },
      }));
    });
  });

  it.each(['0', '0.01', '12.5', '99.99', '100'])('updates a category VAT rate of %s exactly', async (vatRate) => {
    const { prisma, category } = createCategoryVatPrismaMock([
      { id: 'category-1', name: 'Accesorios', isActive: true, vatRate: null },
    ]);
    const service = new InventoryService(prisma as never);

    const result = await service.updateCategoryVat('category-1', vatRate);

    expect(result.vatRate).toBe(new Prisma.Decimal(vatRate).toString());
    expect(category.updateMany).toHaveBeenCalledWith({
      where: { id: 'category-1', isActive: true },
      data: { vatRate: expect.any(Prisma.Decimal) },
    });
    expect(category.updateMany.mock.calls[0][0].data.vatRate.toString()).toBe(vatRate);
  });

  it.each(['', null, 'texto', '-5', '100.01', '12.345', 12.5, undefined] as const)(
    'rejects invalid VAT input %s without changing the stored rate',
    async (vatRate) => {
      const { prisma, categories } = createCategoryVatPrismaMock([
        { id: 'category-1', name: 'Accesorios', isActive: true, vatRate: '15.25' },
      ]);
      const service = new InventoryService(prisma as never);

      await expect(service.updateCategoryVat('category-1', vatRate)).rejects.toMatchObject({ statusCode: 400 });

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(categories[0].vatRate?.toString()).toBe('15.25');
    },
  );

  it.each([
    { categories: [], id: 'missing' },
    { categories: [{ id: 'category-1', name: 'Accesorios', isActive: false, vatRate: '15.25' }], id: 'category-1' },
  ])('does not update a missing or inactive category', async ({ categories: initial, id }) => {
    const { prisma, category, categories } = createCategoryVatPrismaMock(initial);
    const service = new InventoryService(prisma as never);

    await expect(service.updateCategoryVat(id, '20')).rejects.toMatchObject({ statusCode: 404 });

    expect(category.updateMany).toHaveBeenCalledWith({
      where: { id, isActive: true },
      data: { vatRate: expect.any(Prisma.Decimal) },
    });
    if (categories.length === 0) {
      expect(categories).toHaveLength(0);
    } else {
      expect(categories[0].vatRate?.toString()).toBe('15.25');
    }
  });

  it('updates each category independently and returns unset VAT as null when listing categories', async () => {
    const { prisma, categories } = createCategoryVatPrismaMock([
      { id: 'category-1', name: 'Accesorios', isActive: true, vatRate: null },
      { id: 'category-2', name: 'Alimentos', isActive: true, vatRate: '8.5' },
    ]);
    const service = new InventoryService(prisma as never);

    await service.updateCategoryVat('category-1', '0.01');
    await service.updateCategoryVat('category-2', '99.99');

    expect(categories.map((category) => category.vatRate?.toString() ?? null)).toEqual(['0.01', '99.99']);
    expect(await service.listCategories()).toMatchObject([
      { id: 'category-1', vatRate: '0.01' },
      { id: 'category-2', vatRate: '99.99' },
    ]);
    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    categories[1].vatRate = null;
    await expect(service.listCategories()).resolves.toMatchObject([
      { id: 'category-1', vatRate: '0.01' },
      { id: 'category-2', vatRate: null },
    ]);
  });

  it('creates category and brand inline in the product transaction', async () => {
    const { prisma, tx } = createPrismaMock();
    const service = new InventoryService(prisma as never);

    const result = await service.createProduct({
      code: 'PR-001', name: 'Producto', description: 'Descripción del producto', unitPrice: 25.5,
      category: { name: 'Alimentos' }, brand: { name: 'Dog Chow' },
    });

    expect(result.unitPrice).toBe('25.5');
    expect(tx.category.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { name: 'Alimentos' } }));
    expect(tx.marca.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { name: 'Dog Chow' } }));
  });

  it('translates a duplicate product code into a conflict', async () => {
    const duplicateError = {
      code: 'P2002',
      meta: { driverAdapterError: { cause: { constraint: { index: 'products_code_key' } } } },
    };
    const { prisma } = createPrismaMock();
    prisma.$transaction.mockRejectedValue(duplicateError);
    const service = new InventoryService(prisma as never);

    await expect(service.createProduct({
      code: 'PR-001', name: 'Producto', description: 'Descripción del producto', unitPrice: 25.5,
      category: { name: 'Alimentos' }, brand: { name: 'Dog Chow' },
    })).rejects.toMatchObject({
      statusCode: 409,
      message: 'El código del producto ya está registrado',
    } satisfies Partial<ApiException>);
  });

  it('updates a category and trims its editable fields', async () => {
    const { prisma } = createPrismaMock();
    const service = new InventoryService(prisma as never);

    const result = await service.updateCategory('category-1', { name: ' Nutrición ', description: ' Nueva ' });

    expect(result).toMatchObject({ name: 'Nutrición', description: 'Nueva' });
    expect(prisma.category.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'category-1' },
      data: { name: 'Nutrición', description: 'Nueva' },
    }));
  });

  it('translates a duplicate brand name into a conflict', async () => {
    const { prisma } = createPrismaMock();
    prisma.marca.update.mockRejectedValue({ code: 'P2002', meta: { target: ['name'] } });
    const service = new InventoryService(prisma as never);

    await expect(service.updateBrand('brand-1', { name: 'Royal Canin' })).rejects.toMatchObject({
      statusCode: 409,
      message: 'La marca ya está registrada',
    });
  });

  it('translates a duplicate category name into a conflict', async () => {
    const { prisma } = createPrismaMock();
    prisma.category.update.mockRejectedValue({ code: 'P2002', meta: { target: ['name'] } });
    const service = new InventoryService(prisma as never);

    await expect(service.updateCategory('category-1', { name: 'Farmacia' })).rejects.toMatchObject({
      statusCode: 409,
      message: 'La categoría ya está registrada',
    });
  });

  it('rejects an empty category name before touching persistence', async () => {
    const { prisma } = createPrismaMock();
    const service = new InventoryService(prisma as never);

    await expect(service.updateCategory('category-1', { name: ' ' })).rejects.toMatchObject({ statusCode: 400 });
    expect(prisma.category.update).not.toHaveBeenCalled();
  });

  it('loads a product with its category and brand', async () => {
    const { prisma } = createPrismaMock();
    const service = new InventoryService(prisma as never);

    const result = await service.getProduct('product-1');

    expect(result).toMatchObject({ id: 'product-1', category: { name: 'Alimentos' }, brand: { name: 'Dog Chow' } });
    expect(prisma.product.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'product-1', isActive: true } }));
  });

  it('returns not found for an invalid product id format', async () => {
    const { prisma } = createPrismaMock();
    prisma.product.findFirst.mockRejectedValue({ code: 'P2023' });
    const service = new InventoryService(prisma as never);

    await expect(service.getProduct('not-a-uuid')).rejects.toMatchObject({ statusCode: 404, message: 'Producto no encontrado' });
    expect(prisma.product.findFirst).toHaveBeenCalled();
  });

  it('updates a product and serializes its decimal price', async () => {
    const { prisma, tx } = createPrismaMock();
    const service = new InventoryService(prisma as never);

    const result = await service.updateProduct('product-1', {
      code: 'PR-001', name: 'Producto actualizado', description: 'Descripción actualizada', unitPrice: 30,
      category: { id: 'category-1' }, brand: { id: 'brand-1' },
    });

    expect(result.unitPrice).toBe('30');
    expect(tx.product.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'product-1' },
      data: expect.objectContaining({ code: 'PR-001', name: 'Producto actualizado', description: 'Descripción actualizada' }),
    }));
  });

  it('rejects a non-positive price when updating a product', async () => {
    const { prisma } = createPrismaMock();
    const service = new InventoryService(prisma as never);

    await expect(service.updateProduct('product-1', {
      code: 'PR-001', name: 'Producto', description: 'Descripción del producto', unitPrice: 0,
      category: { id: 'category-1' }, brand: { id: 'brand-1' },
    })).rejects.toMatchObject({ statusCode: 400, message: 'Revisa los campos del producto' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an empty description before creating a product', async () => {
    const { prisma } = createPrismaMock();
    const service = new InventoryService(prisma as never);

    await expect(service.createProduct({
      code: 'PR-001', name: 'Producto', description: ' ', unitPrice: 20,
      category: { id: 'category-1' }, brand: { id: 'brand-1' },
    })).rejects.toMatchObject({ statusCode: 400, message: 'Revisa los campos del producto' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns not found when updating a missing product', async () => {
    const { prisma } = createPrismaMock();
    prisma.$transaction.mockRejectedValue({ code: 'P2025' });
    const service = new InventoryService(prisma as never);

    await expect(service.updateProduct('missing', {
      code: 'PR-001', name: 'Producto', description: 'Descripción del producto', unitPrice: 20,
      category: { id: 'category-1' }, brand: { id: 'brand-1' },
    })).rejects.toMatchObject({ statusCode: 404, message: 'Producto no encontrado' });
  });

  it('queries current batches with positive availability and maps the current quantities into alerts', async () => {
    const referenceDate = new Date('2026-11-19T12:00:00.000Z');
    const batchFindMany = vi.fn().mockResolvedValue([{
      id: 'lot-1',
      code: 'L-2026-001',
      expirationDate: new Date('2026-12-19T00:00:00.000Z'),
      availableQuantity: 10,
      product: { name: 'Alimento para perro' },
    }]);
    const service = new InventoryService({ batch: { findMany: batchFindMany } } as never);

    await expect(service.listExpirationAlerts(referenceDate)).resolves.toMatchObject([{
      lotId: 'lot-1',
      productName: 'Alimento para perro',
      lotCode: 'L-2026-001',
      expirationDate: '2026-12-19',
      availableQuantity: 10,
      label: 'Próximo a caducar',
    }]);
    expect(batchFindMany).toHaveBeenCalledWith({
      where: {
        availableQuantity: { gt: 0 },
        expirationDate: { lte: new Date('2026-12-19T00:00:00.000Z') },
      },
      include: { product: { select: { name: true } } },
      orderBy: [{ expirationDate: 'asc' }, { code: 'asc' }],
    });
  });

  it('updates a batch expiry as a date-only value', async () => {
    const batchUpdate = vi.fn().mockResolvedValue({ id: 'lot-1', expirationDate: new Date('2027-01-03T00:00:00.000Z') });
    const service = new InventoryService({ batch: { update: batchUpdate } } as never);

    await expect(service.updateBatchExpiration('lot-1', '2027-01-03')).resolves.toEqual({
      lotId: 'lot-1', expirationDate: '2027-01-03',
    });
    expect(batchUpdate).toHaveBeenCalledWith({
      where: { id: 'lot-1' },
      data: { expirationDate: new Date('2027-01-03T00:00:00.000Z') },
      select: { id: true, expirationDate: true },
    });
  });

  it('rejects invalid expiry dates and returns not found for a missing batch', async () => {
    const batchUpdate = vi.fn().mockRejectedValue({ code: 'P2025' });
    const service = new InventoryService({ batch: { update: batchUpdate } } as never);

    await expect(service.updateBatchExpiration('lot-1', '2027-02-30'))
      .rejects.toMatchObject({ statusCode: 400, message: 'La fecha de caducidad no es válida' });
    expect(batchUpdate).not.toHaveBeenCalled();

    await expect(service.updateBatchExpiration('missing', '2027-01-03'))
      .rejects.toMatchObject({ statusCode: 404, message: 'Lote no encontrado' });
  });

  describe('registerBatchEntry (HU-02)', () => {
    const PRODUCT_ID = '123e4567-e89b-12d3-a456-426614174000';
    const entry = { productId: PRODUCT_ID, code: 'L-2026-001', expirationDate: '2027-10-23', initialQuantity: 50 };

    function createBatchMock() {
      const tx = {
        product: {
          findFirst: vi.fn().mockResolvedValue({ id: PRODUCT_ID }),
          update: vi.fn().mockResolvedValue({ id: PRODUCT_ID, code: 'PR-001', name: 'Alimento para perro', stock: 50 }),
        },
        batch: {
          create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'batch-1', ...data })),
        },
      };
      return { tx, prisma: { $transaction: vi.fn((callback) => callback(tx)) } };
    }

    it('registers the batch and increments the product stock in one transaction', async () => {
      const { prisma, tx } = createBatchMock();
      const service = new InventoryService(prisma as never);

      const result = await service.registerBatchEntry(entry);

      expect(tx.batch.create).toHaveBeenCalledWith({
        data: {
          productId: PRODUCT_ID,
          code: 'L-2026-001',
          expirationDate: new Date(Date.UTC(2027, 9, 23)),
          initialQuantity: 50,
          availableQuantity: 50,
        },
      });
      expect(tx.product.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: PRODUCT_ID },
        data: { stock: { increment: 50 } },
      }));
      expect(result.batch).toMatchObject({
        code: 'L-2026-001', expirationDate: '2027-10-23', initialQuantity: 50, availableQuantity: 50,
      });
      expect(result.product.stock).toBe(50);
    });

    it('rejects invalid data without opening a transaction', async () => {
      const { prisma } = createBatchMock();
      const service = new InventoryService(prisma as never);

      await expect(service.registerBatchEntry({ ...entry, initialQuantity: 0 }))
        .rejects.toMatchObject({ statusCode: 400, message: 'La cantidad inicial debe ser mayor que cero' });
      await expect(service.registerBatchEntry({}))
        .rejects.toMatchObject({ statusCode: 400, message: 'Revisa los datos de la entrada de lote' });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('does not create the batch nor touch stock when the product does not exist', async () => {
      const { prisma, tx } = createBatchMock();
      tx.product.findFirst.mockResolvedValue(null);
      const service = new InventoryService(prisma as never);

      await expect(service.registerBatchEntry(entry))
        .rejects.toMatchObject({ statusCode: 404, message: 'El producto seleccionado no existe' });
      expect(tx.batch.create).not.toHaveBeenCalled();
      expect(tx.product.update).not.toHaveBeenCalled();
    });
  });
});
