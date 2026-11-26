import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { success } from '../../../common/errors/api-response.js';
import { RequirePermissions } from '../../identity/decorators/require-permissions.decorator.js';
import { CreateSupplierDto } from '../dtos/create-supplier.dto.js';
import { ListSuppliersQueryDto } from '../dtos/list-suppliers-query.dto.js';
import { UpdateSupplierDto } from '../dtos/update-supplier.dto.js';
import { SuppliersService } from '../services/suppliers.service.js';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  @RequirePermissions('suppliers:read')
  async list(@Query() query: ListSuppliersQueryDto) {
    return success(await this.suppliers.list(query));
  }

  @Get(':id')
  @RequirePermissions('suppliers:read')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return success(await this.suppliers.findById(id));
  }

  @Post()
  @RequirePermissions('suppliers:create')
  async create(@Body() input: CreateSupplierDto) {
    return success(await this.suppliers.create(input), 'Proveedor registrado correctamente', 201);
  }

  @Patch(':id')
  @RequirePermissions('suppliers:update')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() input: UpdateSupplierDto) {
    return success(await this.suppliers.update(id, input), 'Proveedor actualizado correctamente');
  }

  @Patch(':id/deactivate')
  @RequirePermissions('suppliers:deactivate')
  async deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return success(await this.suppliers.deactivate(id));
  }
}
