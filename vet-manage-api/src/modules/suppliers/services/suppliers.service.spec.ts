import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupplierRecord } from '../repositories/suppliers.repository.js';
import { SuppliersService } from './suppliers.service.js';

const SUPPLIER_ID = '123e4567-e89b-12d3-a456-426614174000';
const OTHER_SUPPLIER_ID = '123e4567-e89b-12d3-a456-426614174001';
const CREATED_AT = new Date('2026-11-20T10:00:00.000Z');

const supplier = (overrides: Partial<SupplierRecord> = {}): SupplierRecord => ({
  id: SUPPLIER_ID,
  businessName: 'Distribuidora Vet',
  ruc: '0012345678001',
  isActive: true,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
  ...overrides,
});

function build() {
  const records = new Map<string, SupplierRecord>();
  records.set(SUPPLIER_ID, supplier());
  records.set(OTHER_SUPPLIER_ID, supplier({
    id: OTHER_SUPPLIER_ID,
    businessName: 'Otro Proveedor',
    ruc: '0098765432001',
  }));

  const repository = {
    create: vi.fn(async ({ businessName, ruc }: { businessName: string; ruc: string }) => {
      const created = supplier({
        id: `supplier-${records.size}`,
        businessName,
        ruc,
        isActive: true,
      });
      records.set(created.id, created);
      return created;
    }),
    findSuppliers: vi.fn(async () => ({ suppliers: [...records.values()], total: records.size })),
    findById: vi.fn(async (id: string) => records.get(id) ?? null),
    findByRuc: vi.fn(async (ruc: string) => {
      const match = [...records.values()].find((item) => item.ruc === ruc);
      return match ? { id: match.id } : null;
    }),
    update: vi.fn(async (id: string, data: Partial<SupplierRecord>) => {
      const current = records.get(id);
      if (!current) throw { code: 'P2025' };
      const updated = { ...current, ...data, updatedAt: new Date('2026-11-20T11:00:00.000Z') };
      records.set(id, updated);
      return updated;
    }),
  };

  return { service: new SuppliersService(repository as never), repository, records };
}

describe('SuppliersService', () => {
  let ctx: ReturnType<typeof build>;

  beforeEach(() => {
    ctx = build();
  });

  it('registra proveedor activo y conserva los ceros iniciales del RUC', async () => {
    const result = await ctx.service.create({ businessName: '  Nueva Distribuidora  ', ruc: '  0000123400001  ' });

    expect(ctx.repository.create).toHaveBeenCalledWith({ businessName: 'Nueva Distribuidora', ruc: '0000123400001' });
    expect(result).toMatchObject({ businessName: 'Nueva Distribuidora', ruc: '0000123400001', isActive: true });
  });

  it.each([
    [{ businessName: '  ', ruc: '0012345678001' }, 'La razón social es obligatoria'],
    [{ businessName: 'Distribuidora Vet', ruc: '   ' }, 'El RUC es obligatorio'],
    [{ businessName: 42, ruc: '0012345678001' }, 'La razón social es obligatoria'],
    [{ businessName: 'Distribuidora Vet', ruc: 123 }, 'El RUC es obligatorio'],
  ])('rechaza campos obligatorios vacíos o de tipo incorrecto', async (input, message) => {
    await expect(ctx.service.create(input as never)).rejects.toMatchObject({ statusCode: 400, message });
    expect(ctx.repository.create).not.toHaveBeenCalled();
  });

  it.each(['123456789012', '12345678901234', '123456789012A', '12345678901 3'])(
    'rechaza RUC %s si no contiene exactamente 13 dígitos numéricos', async (ruc) => {
      await expect(ctx.service.create({ businessName: 'Proveedor', ruc }))
        .rejects.toMatchObject({
          statusCode: 400,
          message: 'El RUC debe contener exactamente 13 dígitos numéricos',
        });
      expect(ctx.repository.create).not.toHaveBeenCalled();
    },
  );

  it('rechaza un RUC que ya existe antes de intentar crear', async () => {
    await expect(ctx.service.create({ businessName: 'Duplicado', ruc: '0012345678001' }))
      .rejects.toMatchObject({ statusCode: 409, message: 'El RUC ya está registrado' });
    expect(ctx.repository.create).not.toHaveBeenCalled();
  });

  it.each([
    [{ code: 'P2002', meta: { target: ['ruc'] } }],
    [{ code: '23505', constraint: 'suppliers_ruc_key' }],
  ])('traduce conflictos de unicidad de Prisma/PostgreSQL a conflicto de negocio', async (databaseError) => {
    ctx.repository.create.mockRejectedValue(databaseError);

    await expect(ctx.service.create({ businessName: 'Concurrente', ruc: '0000000000001' }))
      .rejects.toMatchObject({ statusCode: 409, message: 'El RUC ya está registrado' });
  });

  it('lista los registros con paginación y formato de respuesta', async () => {
    const result = await ctx.service.list({ page: 2, pageSize: 1, search: 'vet', status: 'ACTIVE' });

    expect(ctx.repository.findSuppliers).toHaveBeenCalledWith({ page: 2, pageSize: 1, search: 'vet', status: 'ACTIVE' });
    expect(result).toMatchObject({ page: 2, pageSize: 1, total: 2, totalPages: 2 });
    expect(result.items[0].createdAt).toBe(CREATED_AT.toISOString());
  });

  it('consulta por ID y responde 404 para un proveedor inexistente', async () => {
    await expect(ctx.service.findById(SUPPLIER_ID)).resolves.toMatchObject({ id: SUPPLIER_ID });
    await expect(ctx.service.findById('missing')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('actualiza solo razón social y RUC, manteniendo el UUID y aceptando el mismo RUC', async () => {
    const result = await ctx.service.update(SUPPLIER_ID, { businessName: 'Nombre actualizado', ruc: '0012345678001' });

    expect(ctx.repository.update).toHaveBeenCalledWith(SUPPLIER_ID, {
      businessName: 'Nombre actualizado',
      ruc: '0012345678001',
    });
    expect(result.id).toBe(SUPPLIER_ID);
    expect(result.businessName).toBe('Nombre actualizado');
  });

  it('rechaza asignar el RUC de otro proveedor sin alterar registros', async () => {
    await expect(ctx.service.update(SUPPLIER_ID, { ruc: '0098765432001' }))
      .rejects.toMatchObject({ statusCode: 409, message: 'El RUC ya está registrado' });
    expect(ctx.repository.update).not.toHaveBeenCalled();
    expect(ctx.records.get(SUPPLIER_ID)?.ruc).toBe('0012345678001');
    expect(ctx.records.get(OTHER_SUPPLIER_ID)?.ruc).toBe('0098765432001');
  });

  it('rechaza una actualización vacía y devuelve 404 si no existe', async () => {
    await expect(ctx.service.update(SUPPLIER_ID, {})).rejects.toMatchObject({ statusCode: 400 });
    await expect(ctx.service.update('missing', { businessName: 'Nuevo' })).rejects.toMatchObject({ statusCode: 404 });
    expect(ctx.repository.update).not.toHaveBeenCalled();
  });

  it('rechaza un RUC de actualización que no tenga exactamente 13 dígitos numéricos', async () => {
    await expect(ctx.service.update(SUPPLIER_ID, { ruc: '123456789012A' })).rejects.toMatchObject({
      statusCode: 400,
      message: 'El RUC debe contener exactamente 13 dígitos numéricos',
    });
    expect(ctx.repository.update).not.toHaveBeenCalled();
  });

  it('mantiene independientes los cambios de proveedores distintos', async () => {
    await ctx.service.update(SUPPLIER_ID, { businessName: 'Solo este cambia' });

    expect(ctx.records.get(SUPPLIER_ID)?.businessName).toBe('Solo este cambia');
    expect(ctx.records.get(OTHER_SUPPLIER_ID)?.businessName).toBe('Otro Proveedor');
  });

  it('bloquea la desactivación mientras compras no pueda comprobar órdenes pendientes', async () => {
    await expect(ctx.service.deactivate(SUPPLIER_ID)).rejects.toMatchObject({
      statusCode: 503,
      code: 'SUPPLIER_DEACTIVATION_CHECK_UNAVAILABLE',
    });
    expect(ctx.records.get(SUPPLIER_ID)?.isActive).toBe(true);
  });

  it('no convierte errores de base no relacionados en conflictos de RUC', async () => {
    const failure = new Error('database unavailable');
    ctx.repository.create.mockRejectedValue(failure);

    await expect(ctx.service.create({ businessName: 'Proveedor', ruc: '0000000000001' })).rejects.toBe(failure);
  });
});
