import { Injectable } from '@nestjs/common';
import { ApiException } from '../../../common/errors/api-exception.js';
import type { CreateSupplierDto } from '../dtos/create-supplier.dto.js';
import type { ListSuppliersQueryDto } from '../dtos/list-suppliers-query.dto.js';
import type { SupplierListResponseDto, SupplierResponseDto } from '../dtos/supplier-response.dto.js';
import type { UpdateSupplierDto } from '../dtos/update-supplier.dto.js';
import { SuppliersRepository } from '../repositories/suppliers.repository.js';
import { SUPPLIER_RUC_FORMAT_MESSAGE, SUPPLIER_RUC_PATTERN } from '../ruc-validation.js';

type SupplierWritableFields = { businessName?: string; ruc?: string };

@Injectable()
export class SuppliersService {
  constructor(private readonly repository: SuppliersRepository) {}

  async create(input: CreateSupplierDto): Promise<SupplierResponseDto> {
    const businessName = this.requiredText(input.businessName, 'La razón social es obligatoria');
    const ruc = this.requiredRuc(input.ruc, 'El RUC es obligatorio');
    if (await this.repository.findByRuc(ruc)) {
      throw ApiException.conflict('El RUC ya está registrado');
    }

    try {
      return this.toResponse(await this.repository.create({ businessName, ruc }));
    } catch (error) {
      if (this.isRucUniqueConstraintError(error)) {
        throw ApiException.conflict('El RUC ya está registrado');
      }
      throw error;
    }
  }

  async list(query: ListSuppliersQueryDto): Promise<SupplierListResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const { suppliers, total } = await this.repository.findSuppliers({
      page,
      pageSize,
      search: query.search,
      status: query.status,
    });

    return {
      items: suppliers.map((supplier) => this.toResponse(supplier)),
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async findById(id: string): Promise<SupplierResponseDto> {
    const supplier = await this.repository.findById(id);
    if (!supplier) throw ApiException.notFound('Proveedor no encontrado');
    return this.toResponse(supplier);
  }

  async update(id: string, input: UpdateSupplierDto): Promise<SupplierResponseDto> {
    const existing = await this.repository.findById(id);
    if (!existing) throw ApiException.notFound('Proveedor no encontrado');

    const data: SupplierWritableFields = {};
    if (input.businessName !== undefined) {
      data.businessName = this.requiredText(input.businessName, 'La razón social no puede estar vacía');
    }
    if (input.ruc !== undefined) {
      data.ruc = this.requiredRuc(input.ruc, 'El RUC no puede estar vacío');
      const duplicate = await this.repository.findByRuc(data.ruc);
      if (duplicate && duplicate.id !== id) {
        throw ApiException.conflict('El RUC ya está registrado');
      }
    }
    if (Object.keys(data).length === 0) {
      throw ApiException.badRequest('Debe proporcionar al menos un campo para actualizar');
    }

    try {
      return this.toResponse(await this.repository.update(id, data));
    } catch (error) {
      if (this.isRucUniqueConstraintError(error)) {
        throw ApiException.conflict('El RUC ya está registrado');
      }
      if (this.isRecordNotFoundError(error)) {
        throw ApiException.notFound('Proveedor no encontrado');
      }
      throw error;
    }
  }

  // Las compras aún no están implementadas. Esta ruta bloquea de forma segura y no modifica el registro
  // hasta que la comprobación transaccional de órdenes pendientes esté disponible.
  async deactivate(id: string): Promise<never> {
    if (!await this.repository.findById(id)) throw ApiException.notFound('Proveedor no encontrado');

    throw new ApiException(
      'No se puede desactivar el proveedor porque aún no es posible verificar órdenes de compra pendientes',
      503,
      [],
      'SUPPLIER_DEACTIVATION_CHECK_UNAVAILABLE',
    );
  }

  private requiredText(value: unknown, message: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw ApiException.badRequest(message);
    }
    // Trim exterior whitespace only; in particular, do not parse or strip leading zeroes from the RUC.
    return value.trim();
  }

  private requiredRuc(value: unknown, message: string): string {
    const ruc = this.requiredText(value, message);
    if (!SUPPLIER_RUC_PATTERN.test(ruc)) throw ApiException.badRequest(SUPPLIER_RUC_FORMAT_MESSAGE);
    return ruc;
  }

  private toResponse(supplier: {
    id: string;
    businessName: string;
    ruc: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): SupplierResponseDto {
    return {
      id: supplier.id,
      businessName: supplier.businessName,
      ruc: supplier.ruc,
      isActive: supplier.isActive,
      createdAt: supplier.createdAt.toISOString(),
      updatedAt: supplier.updatedAt.toISOString(),
    };
  }

  private isRucUniqueConstraintError(error: unknown): boolean {
    const details = this.errorDetails(error);
    if (details.code !== 'P2002' && details.code !== '23505') return false;
    return details.targets.some((target) => target === 'ruc' || target.includes('suppliers_ruc_key'));
  }

  private isRecordNotFoundError(error: unknown): boolean {
    return this.errorDetails(error).code === 'P2025';
  }

  private errorDetails(error: unknown): { code?: string; targets: string[] } {
    if (!error || typeof error !== 'object') return { targets: [] };

    const known = error as {
      code?: unknown;
      originalCode?: unknown;
      constraint?: unknown;
      meta?: { target?: unknown; driverAdapterError?: { cause?: { originalCode?: unknown; constraint?: unknown } } };
      cause?: { originalCode?: unknown; constraint?: unknown };
    };
    const driverCause = known.meta?.driverAdapterError?.cause;
    const code = known.code ?? known.originalCode ?? known.cause?.originalCode ?? driverCause?.originalCode;
    const target = known.meta?.target ?? known.constraint ?? known.cause?.constraint ?? driverCause?.constraint;
    const targets = Array.isArray(target)
      ? target.map(String)
      : typeof target === 'string'
        ? [target]
        : typeof target === 'object' && target !== null && 'index' in target
          ? [String(target.index)]
          : [];

    return { code: typeof code === 'string' ? code : undefined, targets };
  }
}
