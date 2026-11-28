import { Injectable } from '@nestjs/common';
import { AppointmentsRepository } from '../repositories/appointments.repository.js';

@Injectable()
export class ListAppointmentsService {
  constructor(
    private readonly appointments: AppointmentsRepository,
  ) {}

  async execute() {
    const appointments = await this.appointments.listAppointments();

    return appointments.map((appointment) => ({
      id: appointment.id,
      numero: appointment.numero,
      estado: appointment.estado,
      fechaHora: appointment.fechaHora.toISOString(),
      fechaHoraFin: appointment.fechaHoraFin.toISOString(),
      paciente: appointment.paciente.name,
      sucursal: appointment.sala.sucursal.nombre,
      sala: appointment.sala.nombre,
      veterinario: [
        appointment.veterinario.person.firstName,
        appointment.veterinario.person.lastName,
      ].join(' '),
      tienePagoAprobado: appointment.pagos.length > 0,
    }));
  }
}
