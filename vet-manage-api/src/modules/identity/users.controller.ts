import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiException } from '../../common/errors/api-exception.js';
import { success } from '../../common/errors/api-response.js';
import { RequirePermissions } from './decorators/require-permissions.decorator.js';
import { QueryUsersDto } from './dtos/query-users.dto.js';
import { RegisterUserDto } from './dtos/register-user.dto.js';
import { UpdateUserRoleAssignmentDto } from './dtos/update-user-role-assignment.dto.js';
import { UserQueryService } from './services/user-query.service.js';
import { UserRegistrationService } from './services/user-registration.service.js';
import { UserRoleAssignmentService } from './services/user-role-assignment.service.js';
import type { AuthenticatedRequest } from './types/authenticated-request.js';

@Controller('users')
export class UsersController {
  constructor(
    private readonly registration: UserRegistrationService,
    private readonly query: UserQueryService,
    private readonly roleAssignment: UserRoleAssignmentService,
  ) {}

  @Get()
  @RequirePermissions('users:read')
  async list(@Query() query: QueryUsersDto) {
    return success(await this.query.list(query), 'Usuarios consultados correctamente');
  }

  @Post()
  @HttpCode(201)
  @RequirePermissions('users:create')
  async register(@Body() input: RegisterUserDto, @Req() request: AuthenticatedRequest) {
    if (!request.user) throw ApiException.unauthorized();
    const { message, user } = await this.registration.register(input, request.user.id);
    return success(user, message, 201);
  }

  @Get('assignable-roles')
  @RequirePermissions('users:create')
  async assignableRoles() {
    return success(await this.registration.listAssignableRoles());
  }

  @Get(':id/role-assignment')
  @RequirePermissions('users:assign-roles')
  async getRoleAssignment(@Param('id') id: string) {
    return success(await this.roleAssignment.get(id), 'Asignación de roles consultada correctamente');
  }

  @Put(':id/role-assignment')
  @RequirePermissions('users:assign-roles')
  async updateRoleAssignment(
    @Param('id') id: string,
    @Body() input: UpdateUserRoleAssignmentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.user) throw ApiException.unauthorized();
    return success(
      await this.roleAssignment.update(id, input.roles, request.user.id),
      'Roles actualizados correctamente',
    );
  }
}
