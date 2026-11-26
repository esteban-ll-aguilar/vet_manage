import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { ApiException } from '../../common/errors/api-exception.js';
import { success } from '../../common/errors/api-response.js';
import { RequirePermissions } from './decorators/require-permissions.decorator.js';
import { ChangeUserStatusDto } from './dtos/change-user-status.dto.js';
import { DeactivateUserDto } from './dtos/deactivate-user.dto.js';
import { QueryUsersDto } from './dtos/query-users.dto.js';
import { RegisterUserDto } from './dtos/register-user.dto.js';
import { UpdateUserDto } from './dtos/update-user.dto.js';
import { UpdateUserRoleAssignmentDto } from './dtos/update-user-role-assignment.dto.js';
import { ChangeUserStatusService } from './services/change-user-status.service.js';
import { DeactivateUserService } from './services/deactivate-user.service.js';
import { UpdateUserService } from './services/update-user.service.js';
import { USER_DETAIL_MESSAGES, UserDetailService } from './services/user-detail.service.js';
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
    private readonly statusChange: ChangeUserStatusService,
    private readonly detail: UserDetailService,
    private readonly updateUser: UpdateUserService,
    private readonly deactivation: DeactivateUserService,
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

  // Las rutas con :id van después de las fijas (assignable-roles) para no capturarlas.
  @Get(':id')
  @RequirePermissions('users:read')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return success(await this.detail.get(id), USER_DETAIL_MESSAGES.found);
  }

  @Patch(':id')
  @RequirePermissions('users:update')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() input: UpdateUserDto, @Req() request: AuthenticatedRequest) {
    if (!request.user) throw ApiException.unauthorized();
    const { message, user, noticeSent } = await this.updateUser.update(id, input, request.user.id);
    return success({ ...user, noticeSent }, message);
  }

  @Patch(':id/status')
  @RequirePermissions('users:change-status')
  async changeStatus(
    @Param('id') id: string,
    @Body() input: ChangeUserStatusDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.user) throw ApiException.unauthorized();
    const { message, user } = await this.statusChange.changeStatus(id, input.status, request.user.id);
    return success(user, message);
  }

  @Patch(':id/deactivate')
  @RequirePermissions('users:deactivate')
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: DeactivateUserDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.user) throw ApiException.unauthorized();
    const { message, user } = await this.deactivation.deactivate(id, input, request.user.id);
    return success(user, message);
  }
}
