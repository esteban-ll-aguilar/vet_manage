import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { success } from '../../../common/errors/api-response.js';
import { RequirePermissions } from '../../identity/decorators/require-permissions.decorator.js';
import { ListClientsQueryDto } from '../dtos/list-clients-query.dto.js';
import { ClientsService } from '../services/clients.service.js';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

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
}
