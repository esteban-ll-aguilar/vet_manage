import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { ApiException } from '../../../common/errors/api-exception.js';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';
import { CreateCatalogItemDto } from '../dtos/create-catalog-item.dto.js';
import { CatalogReferenceDto } from '../dtos/catalog-reference.dto.js';
import { CreateProductDto } from '../dtos/create-product.dto.js';
import { RegisterBatchEntryDto } from '../dtos/register-batch-entry.dto.js';
import { validateBatchEntryInput } from './batch-entry-input.service.js';
import { findExpirationAlerts, getExpirationAlertCutoff } from './expiration-alerts.service.js';
import { validateProductInput } from './product-input.service.js';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);
  constructor(private readonly prisma: PrismaService) {}

  listCategories() {
    return this.prisma.category.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }

  createCategory(input: CreateCatalogItemDto) {
    return this.createCatalogItem('category', input);
  }

  updateCategory(id: string, input: CreateCatalogItemDto) {
    return this.updateCatalogItem('category', id, input);
  }

  listBrands() {
    return this.prisma.marca.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }

  createBrand(input: CreateCatalogItemDto) {
    return this.createCatalogItem('brand', input);
  }

  updateBrand(id: string, input: CreateCatalogItemDto) {
    return this.updateCatalogItem('brand', id, input);
  }

  async listProducts(search?: string) {
    const normalizedSearch = search?.trim();
    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        ...(normalizedSearch ? {
          OR: [
            { code: { contains: normalizedSearch, mode: 'insensitive' } },
            { name: { contains: normalizedSearch, mode: 'insensitive' } },
          ],
        } : {}),
      },
      include: { category: true, brand: true },
      orderBy: { createdAt: 'desc' },
    });

    return products.map((product) => this.serializeProduct(product));
  }

  async listExpirationAlerts(referenceDate = new Date()) {
    const batches = await this.prisma.batch.findMany({
      where: {
        availableQuantity: { gt: 0 },
        expirationDate: { lte: getExpirationAlertCutoff(referenceDate) },
      },
      include: { product: { select: { name: true } } },
      orderBy: [{ expirationDate: 'asc' }, { code: 'asc' }],
    });

    return findExpirationAlerts(batches.map((batch) => ({
      lotId: batch.id,
      productName: batch.product.name,
      lotCode: batch.code,
      expirationDate: batch.expirationDate,
      availableQuantity: batch.availableQuantity,
    })), referenceDate);
  }

  async updateBatchExpiration(id: string, value: unknown) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw ApiException.badRequest('La fecha de caducidad no es válida');
    }

    const [year, month, day] = value.split('-').map(Number);
    const expirationDate = new Date(Date.UTC(year, month - 1, day));
    if (expirationDate.toISOString().slice(0, 10) !== value) {
      throw ApiException.badRequest('La fecha de caducidad no es válida');
    }

    try {
      const batch = await this.prisma.batch.update({
        where: { id },
        data: { expirationDate },
        select: { id: true, expirationDate: true },
      });

      return { lotId: batch.id, expirationDate: batch.expirationDate.toISOString().slice(0, 10) };
    } catch (error) {
      if (this.isNotFoundError(error)) throw ApiException.notFound('Lote no encontrado');
      throw error;
    }
  }

  async getProduct(id: string) {
    try {
      const product = await this.prisma.product.findFirst({
        where: { id, isActive: true },
        include: { category: true, brand: true },
      });
      if (!product) throw ApiException.notFound('Producto no encontrado');
      return this.serializeProduct(product);
    } catch (error) {
      if (this.isNotFoundError(error)) throw ApiException.notFound('Producto no encontrado');
      throw error;
    }
  }

  async createProduct(input: CreateProductDto) {
    const validation = validateProductInput(input);
    if (!validation.valid) {
      throw ApiException.badRequest('Revisa los campos del producto', Object.values(validation.errors));
    }

    try {
      const product = await this.prisma.$transaction(async (tx) => {
        const categoryId = await this.resolveCatalogReference(tx, 'category', input.category);
        const brandId = await this.resolveCatalogReference(tx, 'brand', input.brand);

        return tx.product.create({
          data: {
            code: input.code.trim(),
            name: input.name.trim(),
            description: input.description?.trim() || null,
            unitPrice: new Prisma.Decimal(input.unitPrice),
            categoryId,
            brandId,
          },
          include: { category: true, brand: true },
        });
      });

      return this.serializeProduct(product);
    } catch (error) {
      if (this.isUniqueConstraintError(error, ['products_code_key', 'code'])) {
        throw ApiException.conflict('El código del producto ya está registrado');
      }

      if (this.isUniqueConstraintError(error, ['categories_name_key', 'name'])) {
        throw ApiException.conflict('La categoría ya está registrada');
      }

      if (this.isUniqueConstraintError(error, ['brands_name_key', 'name'])) {
        throw ApiException.conflict('La marca ya está registrada');
      }

      this.logger.error('No se pudo registrar el producto', error);
      throw error;
    }
  }

  async updateProduct(id: string, input: CreateProductDto) {
    const validation = validateProductInput(input);
    if (!validation.valid) {
      throw ApiException.badRequest('Revisa los campos del producto', Object.values(validation.errors));
    }

    try {
      const product = await this.prisma.$transaction(async (tx) => {
        const categoryId = await this.resolveCatalogReference(tx, 'category', input.category);
        const brandId = await this.resolveCatalogReference(tx, 'brand', input.brand);

        return tx.product.update({
          where: { id },
          data: {
            code: input.code.trim(),
            name: input.name.trim(),
            description: input.description?.trim() || null,
            unitPrice: new Prisma.Decimal(input.unitPrice),
            categoryId,
            brandId,
          },
          include: { category: true, brand: true },
        });
      });

      return this.serializeProduct(product);
    } catch (error) {
      if (this.isNotFoundError(error)) throw ApiException.notFound('Producto no encontrado');
      if (this.isUniqueConstraintError(error, ['products_code_key', 'code'])) {
        throw ApiException.conflict('El código del producto ya está registrado');
      }
      if (this.isUniqueConstraintError(error, ['categories_name_key', 'name'])) {
        throw ApiException.conflict('La categoría ya está registrada');
      }
      if (this.isUniqueConstraintError(error, ['brands_name_key', 'name'])) {
        throw ApiException.conflict('La marca ya está registrada');
      }
      this.logger.error('No se pudo actualizar el producto', error);
      throw error;
    }
  }

  // HU-02: registra el lote y suma su cantidad al stock en una sola transacción.
  // Si algo falla, no se crea el lote ni cambian las existencias.
  async registerBatchEntry(input: RegisterBatchEntryDto) {
    const validation = validateBatchEntryInput(input);
    if (!validation.valid) {
      const messages = Object.values(validation.errors);
      throw ApiException.badRequest(
        messages.length === 1 ? messages[0] : 'Revisa los datos de la entrada de lote',
        messages,
      );
    }

    const { productId, code, expirationDate, initialQuantity } = validation.value;
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({ where: { id: productId, isActive: true }, select: { id: true } });
      if (!product) throw ApiException.notFound('El producto seleccionado no existe');

      const batch = await tx.batch.create({
        data: { productId, code, expirationDate, initialQuantity, availableQuantity: initialQuantity },
      });
      const updated = await tx.product.update({
        where: { id: productId },
        data: { stock: { increment: initialQuantity } },
        select: { id: true, code: true, name: true, stock: true },
      });

      return {
        batch: { ...batch, expirationDate: batch.expirationDate.toISOString().slice(0, 10) },
        product: updated,
      };
    });
  }

  private async createCatalogItem(type: 'category' | 'brand', input: CreateCatalogItemDto) {
    try {
      const data = { name: input.name.trim(), description: input.description?.trim() || null };
      return type === 'category'
        ? await this.prisma.category.create({ data })
        : await this.prisma.marca.create({ data });
    } catch (error) {
      if (this.isUniqueConstraintError(error, [`${type === 'category' ? 'categories' : 'brands'}_name_key`, 'name'])) {
        throw ApiException.conflict(`${type === 'category' ? 'La categoría' : 'La marca'} ya está registrada`);
      }

      throw error;
    }
  }

  private async updateCatalogItem(type: 'category' | 'brand', id: string, input: CreateCatalogItemDto) {
    const name = input.name.trim();
    if (!name) {
      throw ApiException.badRequest(`El nombre de la ${type === 'category' ? 'categoría' : 'marca'} es obligatorio`);
    }

    let existing;
    try {
      existing = type === 'category'
        ? await this.prisma.category.findUnique({ where: { id } })
        : await this.prisma.marca.findUnique({ where: { id } });
    } catch (error) {
      if (this.isNotFoundError(error)) throw ApiException.notFound(`${type === 'category' ? 'Categoría' : 'Marca'} no encontrada`);
      throw error;
    }
    if (!existing || !existing.isActive) {
      throw ApiException.notFound(`${type === 'category' ? 'Categoría' : 'Marca'} no encontrada`);
    }

    try {
      const data = { name, description: input.description?.trim() || null };
      return type === 'category'
        ? await this.prisma.category.update({ where: { id }, data })
        : await this.prisma.marca.update({ where: { id }, data });
    } catch (error) {
      if (this.isUniqueConstraintError(error, [`${type === 'category' ? 'categories' : 'brands'}_name_key`, 'name'])) {
        throw ApiException.conflict(`${type === 'category' ? 'La categoría' : 'La marca'} ya está registrada`);
      }
      throw error;
    }
  }

  private async resolveCatalogReference(
    tx: Prisma.TransactionClient,
    type: 'category' | 'brand',
    reference: CatalogReferenceDto,
  ) {
    if (reference.id) {
      const item = type === 'category'
        ? await tx.category.findFirst({ where: { id: reference.id, isActive: true } })
        : await tx.marca.findFirst({ where: { id: reference.id, isActive: true } });
      if (!item) throw ApiException.badRequest(`La ${type === 'category' ? 'categoría' : 'marca'} seleccionada no existe`);
      return item.id;
    }

    const name = reference.name?.trim();
    if (!name) throw ApiException.badRequest(`La ${type === 'category' ? 'categoría' : 'marca'} es obligatoria`);
    const item = type === 'category'
      ? await tx.category.upsert({ where: { name }, update: { isActive: true }, create: { name } })
      : await tx.marca.upsert({ where: { name }, update: { isActive: true }, create: { name } });
    return item.id;
  }

  private isUniqueConstraintError(error: unknown, targets: string[]) {
    if (!error || typeof error !== 'object') return false;
    const knownError = error as {
      code?: unknown;
      originalCode?: unknown;
      message?: unknown;
      constraint?: unknown;
      meta?: { target?: unknown; driverAdapterError?: { cause?: { originalCode?: unknown; constraint?: unknown } } };
      cause?: unknown;
    };
    const cause = knownError.cause && typeof knownError.cause === 'object'
      ? knownError.cause as { originalCode?: unknown; constraint?: unknown }
      : undefined;
    const driverCause = knownError.meta?.driverAdapterError?.cause;
    const code = knownError.code ?? knownError.originalCode ?? cause?.originalCode ?? driverCause?.originalCode;
    if (code !== 'P2002' && code !== '23505') return false;
    const constraintTarget = knownError.meta?.target
      ?? knownError.constraint
      ?? cause?.constraint
      ?? driverCause?.constraint;
    const targetText = typeof constraintTarget === 'object' && constraintTarget !== null && 'index' in constraintTarget
      ? String(constraintTarget.index)
      : Array.isArray(constraintTarget) ? constraintTarget.join('_') : typeof constraintTarget === 'string' ? constraintTarget : '';
    return targets.some((target) => targetText === target || targetText.includes(target));
  }

  private isNotFoundError(error: unknown) {
    if (!error || typeof error !== 'object') return false;
    const knownError = error as {
      code?: unknown;
      originalCode?: unknown;
      message?: unknown;
      cause?: { code?: unknown; originalCode?: unknown };
      meta?: { driverAdapterError?: { cause?: { originalCode?: unknown } } };
    };
    const errorText = typeof knownError.message === 'string' ? knownError.message.toLowerCase() : '';
    return [knownError.code, knownError.originalCode, knownError.cause?.code,
      knownError.cause?.originalCode, knownError.meta?.driverAdapterError?.cause?.originalCode]
      .some((code) => code === 'P2025' || code === 'P2023')
      || errorText.includes('invalid input syntax for type uuid')
      || errorText.includes('invalid value for argument');
  }

  private serializeProduct(product: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    unitPrice: Prisma.Decimal;
    category: { id: string; name: string };
    brand: { id: string; name: string };
    createdAt: Date;
  }) {
    return {
      ...product,
      unitPrice: product.unitPrice.toString(),
    };
  }
}
