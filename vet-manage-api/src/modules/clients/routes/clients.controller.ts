import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req } from '@nestjs/common';
import { ApiException } from '../../../common/errors/api-exception.js';
import { success } from '../../../common/errors/api-response.js';
import { RequirePermissions } from '../../identity/decorators/require-permissions.decorator.js';
import type { AuthenticatedRequest } from '../../identity/types/authenticated-request.js';
import { DeactivateClientDto } from '../dtos/deactivate-client.dto.js';
import { ListClientsQueryDto } from '../dtos/list-clients-query.dto.js';
import { UpdateClientDto } from '../dtos/update-client.dto.js';
import { ChangeClientStatusService } from '../services/change-client-status.service.js';
import { ClientsService } from '../services/clients.service.js';
import { UpdateClientService } from '../services/update-client.service.js';

@Controller('clients')
export class ClientsController {
  constructor(
    private readonly clients: ClientsService,
    private readonly statusChange: ChangeClientStatusService,
    private readonly updateClient: UpdateClientService,
  ) {}

  @Get()
  @RequirePermissions('clients:read')
  async list(@Query() query: ListClientsQueryDto) {
    return success(await this.clients.list(query));
  }

  @Get(':clientId/pets')
  @RequirePermissions('pets:read')
  async listPets(@Param('clientId', ParseUUIDPipe) clientId: string) {
    return success(await this.clients.listPets(clientId));
  }

  @Patch(':clientId/inactivate')
  @RequirePermissions('clients:inactivate')
  async inactivate(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.user) throw ApiException.unauthorized();
    const { message, client } = await this.statusChange.inactivate(clientId, request.user.id);
    return success(client, message);
  }

  // Vuelve a activar un cliente inactivo (HU-05); un cliente dado de baja no se puede activar.
  @Patch(':clientId/activate')
  @RequirePermissions('clients:activate')
  async activate(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.user) throw ApiException.unauthorized();
    const { message, client } = await this.statusChange.activate(clientId, request.user.id);
    return success(client, message);
  }

  // Baja definitiva del cliente (HU-03): solo Gerente y Veterinario (clients:deactivate).
  @Patch(':clientId/deactivate')
  @RequirePermissions('clients:deactivate')
  async deactivate(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() dto: DeactivateClientDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.user) throw ApiException.unauthorized();
    const { message, client } = await this.statusChange.deactivate(clientId, dto.reason, request.user.id);
    return success(client, message);
  }

  // Actualiza los datos de contacto del cliente (HU-02); la cédula no se modifica.
  @Patch(':clientId')
  @RequirePermissions('clients:update')
  async update(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() dto: UpdateClientDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.user) throw ApiException.unauthorized();
    const { message, client } = await this.updateClient.update(clientId, dto, request.user.id);
    return success(client, message);
  }
}
