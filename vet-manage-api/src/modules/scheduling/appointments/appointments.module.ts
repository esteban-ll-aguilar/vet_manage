import { ListAppointmentsService } from './services/list-appointments.service.js';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../infrastructure/database/prisma/prisma.module.js';
import { IdentityModule } from '../../identity/identity.module.js';
import { BranchesModule } from '../branches/branches.module.js';
import { AppointmentModificationRepository } from './repositories/appointment-modification.repository.js';
import { AppointmentsRepository } from './repositories/appointments.repository.js';
import { AppointmentModificationController } from './routes/appointment-modification.controller.js';
import { AppointmentsController } from './routes/appointments.controller.js';
import { CancelAppointmentService } from './services/cancel-appointment.service.js';
import { ModifyAppointmentService } from './services/modify-appointment.service.js';
import { RegisterAppointmentService } from './services/register-appointment.service.js';

@Module({
  imports: [PrismaModule, IdentityModule, BranchesModule],
  controllers: [AppointmentsController, AppointmentModificationController],
  providers: [
    AppointmentModificationRepository,
    AppointmentsRepository,
    CancelAppointmentService,
    ListAppointmentsService,
    ModifyAppointmentService,
    RegisterAppointmentService,
  ],
})
export class AppointmentsModule {}
