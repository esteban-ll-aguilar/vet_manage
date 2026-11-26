import { Injectable } from '@nestjs/common';
import { WorkScheduleRepository } from '../repositories/work-schedule.repository.js';
import { toWorkScheduleResponse } from '../dtos/work-schedule-response.dto.js';
import type { QueryWorkSchedulesDto } from '../dtos/query-work-schedules.dto.js';

@Injectable()
export class ListWorkSchedulesService {
  constructor(private readonly repo: WorkScheduleRepository) {}

  async list(query: QueryWorkSchedulesDto) {
    const records = await this.repo.findActive({
      veterinarioId: query.veterinarioId,
      sucursalId: query.sucursalId,
    });
    return records.map(toWorkScheduleResponse);
  }

  listVeterinarians() {
    return this.repo.findActiveVeterinarians();
  }
}
