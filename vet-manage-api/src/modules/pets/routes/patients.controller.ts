import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiException } from '../../../common/errors/api-exception.js';
import { success } from '../../../common/errors/api-response.js';
import { JwtAuthGuard } from '../../identity/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../identity/guards/permissions.guard.js';
import { RequirePermissions } from '../../identity/decorators/require-permissions.decorator.js';
import type { AuthenticatedRequest } from '../../identity/types/authenticated-request.js';
import { RegisterPatientDto } from '../dtos/patients/register-patient.dto.js';
import { PATIENT_MESSAGES, RegisterPatientService } from '../services/patients/register-patient.service.js';

@Controller('pets')
export class PatientsController {
  constructor(private readonly registerPatientService: RegisterPatientService) {}

  // Recepcionista, Gerente y Veterinario tienen pets:create.
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('pets:create')
  async registerPatient(@Body() dto: RegisterPatientDto, @Req() request: AuthenticatedRequest) {
    if (!request.user) throw ApiException.unauthorized();
    return success(await this.registerPatientService.execute(dto, request.user.id), PATIENT_MESSAGES.registered, 201);
  }
}
