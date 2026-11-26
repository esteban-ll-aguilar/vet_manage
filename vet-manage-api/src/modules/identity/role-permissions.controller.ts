import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Req } from '@nestjs/common';
import { ApiException } from '../../common/errors/api-exception.js';
import { success } from '../../common/errors/api-response.js';
import { RequirePermissions } from './decorators/require-permissions.decorator.js';
import { UpdateRolePermissionsDto } from './dtos/update-role-permissions.dto.js';
import { ROLE_PERMISSIONS_MESSAGES, RolePermissionsService } from './services/role-permissions.service.js';
import type { AuthenticatedRequest } from './types/authenticated-request.js';

@Controller('roles')
export class RolePermissionsController {
  constructor(private readonly rolePermissions: RolePermissionsService) {}

  @Get('permissions')
  @RequirePermissions('roles:manage-permissions')
  async getCatalog() {
    return success(await this.rolePermissions.getCatalog(), 'Permisos por rol consultados correctamente');
  }

  @Put(':id/permissions')
  @RequirePermissions('roles:manage-permissions')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateRolePermissionsDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.user) throw ApiException.unauthorized();
    return success(
      await this.rolePermissions.update(id, input.permissionKeys, request.user.id),
      ROLE_PERMISSIONS_MESSAGES.updated,
    );
  }
}
