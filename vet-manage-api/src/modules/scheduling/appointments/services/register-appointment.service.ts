import { Injectable } from '@nestjs/common';
import { ApiException } from '../../../../common/errors/api-exception.js';
import { BranchRepository } from '../../branches/repositories/branch.repository.js';
import type { RegisterAppointmentDto } from '../dtos/register-appointment.dto.js';
import { AppointmentsRepository } from '../repositories/appointments.repository.js';

@Injectable()
export class RegisterAppointmentService {
  constructor(
    private readonly appointments: AppointmentsRepository,
    private readonly branches: BranchRepository,
  ) {}

  async register(dto: RegisterAppointmentDto, registradaPorId: string) {
    const [activeBranches, activeServices] = await Promise.all([
      this.branches.findActiveBranchesWithRooms(),
      this.branches.findActiveServices(),
    ]);
    const branch = activeBranches.find((item) => item.id === dto.sucursalId);
    if (!branch) throw ApiException.badRequest('La sucursal no está activa');
    if (!branch.salas.some((room) => room.id === dto.salaId && room.tipo === 'CONSULTORIO')) {
      throw ApiException.badRequest('El consultorio no está disponible');
    }
    if (!activeServices.some((service) => service.id === dto.servicioId)) {
      throw ApiException.badRequest('El servicio no está activo');
    }

    return this.appointments.register(dto, registradaPorId);
  }
}
