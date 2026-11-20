import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ApiException } from '../../../common/errors/api-exception.js';
import { success } from '../../../common/errors/api-response.js';
import { RequirePermissions } from '../decorators/require-permissions.decorator.js';
import { ClientRegistrationDto } from '../dtos/client-registration.dto.js';
import { ClientRegistrationService } from '../services/client-registration.service.js';
import type { AuthenticatedRequest } from '../types/authenticated-request.js';

@Controller('clients')
export class ClientRegistrationController {
  constructor(private readonly registration: ClientRegistrationService) {}

  @Post()
  @HttpCode(201)
  @RequirePermissions('clients:create')
  async register(@Body() input: ClientRegistrationDto, @Req() request: AuthenticatedRequest) {
    if (!request.user) throw ApiException.unauthorized();
    const { message, client } = await this.registration.register(input, request.user.id);
    return success(client, message, 201);
  }

  @Get('assignable-roles')
  @RequirePermissions('clients:create')
  async assignableRoles() {
    return success(await this.registration.listAssignableRoles());
  }
}
