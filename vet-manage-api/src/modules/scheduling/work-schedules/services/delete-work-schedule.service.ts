import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { WorkScheduleRepository } from '../repositories/work-schedule.repository.js';
import { dbTimeToMinutes } from '../../common/time-slots.js';

@Injectable()
export class DeleteWorkScheduleService {
  constructor(private readonly repo: WorkScheduleRepository) {}

  async remove(id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException('Horario no encontrado');
    }

    // Check for future confirmed/programmed appointments on this day for this vet.
    // Use range [0, 0) so every cita's time is "outside" and gets counted.
    const futureAppointments = await this.repo.countConflictingAppointments(
      existing.veterinarioId,
      existing.diaSemana,
      dbTimeToMinutes(existing.horaInicio),
      dbTimeToMinutes(existing.horaFin),
    );
    if (futureAppointments > 0) {
      throw new BadRequestException(
        'No se puede eliminar el horario: existen citas futuras programadas o confirmadas',
      );
    }

    const futureAvailability = await this.repo.countAvailability(id);
    if (futureAvailability > 0) {
      throw new BadRequestException(
        'No se puede eliminar el horario: existen disponibilidades diarias futuras',
      );
    }

    await this.repo.softDelete(id);
  }
}
