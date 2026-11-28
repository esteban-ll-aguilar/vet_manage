import { AppointmentsModule } from './appointments/appointments.module.js';
import { Module } from '@nestjs/common';
import { BranchesModule } from './branches/branches.module.js';
import { DailyAvailabilityModule } from './daily-availability/daily-availability.module.js';
import { RatesModule } from './rates/rates.module.js';
import { ResourcesModule } from './resources/resources.module.js';
import { SaturdayShiftsModule } from './saturday-shifts/saturday-shifts.module.js';
import { ScheduleBlocksModule } from './schedule-blocks/schedule-blocks.module.js';
import { WorkSchedulesModule } from './work-schedules/work-schedules.module.js';

import { CalendarModule } from './calendar/calendar.module.js';

// Cada sección de la agenda tiene su propia carpeta y módulo; este archivo solo los agrupa.
@Module({
  imports: [
    CalendarModule,
    AppointmentsModule,
    BranchesModule,
    WorkSchedulesModule,
    SaturdayShiftsModule,
    DailyAvailabilityModule,
    ScheduleBlocksModule,
    RatesModule,
    ResourcesModule,
  ],
})
export class SchedulingModule {}
