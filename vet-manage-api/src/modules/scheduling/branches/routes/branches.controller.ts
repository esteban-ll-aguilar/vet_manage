import { Controller, Get } from '@nestjs/common';
import { success } from '../../../../common/errors/api-response.js';
import { RequirePermissions } from '../../../identity/decorators/require-permissions.decorator.js';
import { ListBranchesService } from '../services/list-branches.service.js';

@Controller('scheduling')
export class BranchesController {
  constructor(private readonly listBranchesService: ListBranchesService) {}

  // Sucursales activas con sus salas activas (consultorios y quirófanos).
  @Get('branches')
  @RequirePermissions('branches:read')
  async listBranches() {
    return success(await this.listBranchesService.listBranches(), 'Sucursales activas');
  }

  @Get('services')
  @RequirePermissions('branches:read')
  async listServices() {
    return success(await this.listBranchesService.listServices(), 'Servicios activos');
  }
}
