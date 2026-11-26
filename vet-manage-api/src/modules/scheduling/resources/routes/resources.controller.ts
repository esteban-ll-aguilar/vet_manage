
import { Controller, Get, Query } from '@nestjs/common';
import { success } from '../../../../common/errors/api-response.js';
import { RequirePermissions } from '../../../identity/decorators/require-permissions.decorator.js';
import { ConsultAvailableResourcesDto } from '../dtos/consult-available-resources.dto.js';
import { ResourcesService } from '../services/resources.service.js';

@Controller('scheduling/resources')
export class ResourcesController {
  constructor(
    private readonly resourcesService: ResourcesService,
  ) {}

  @Get('availability')
  @RequirePermissions('resources:read-availability')
  async consultAvailableResources(
    @Query() query: ConsultAvailableResourcesDto,
  ) {
    const resources =
      await this.resourcesService.consultAvailableResources(query);

    return success(
      resources,
      'Recursos disponibles consultados correctamente',
    );
  }
}
