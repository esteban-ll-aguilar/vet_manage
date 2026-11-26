import { Injectable } from '@nestjs/common';
import { ApiException } from '../../../../common/errors/api-exception.js';
import { ScheduleBlockRepository } from '../repositories/schedule-block.repository.js';
import { toScheduleBlockResponse, type ScheduleBlockResponse } from './schedule-block.mapper.js';
import { parseDate } from './schedule-block-input.js';

export type ScheduleBlockFilter = { sucursalId?: string; desde?: string; hasta?: string };

export const LIST_BLOCK_MESSAGES = {
  invalidBranch: 'La sucursal indicada no es válida',
  invalidDate: 'Las fechas deben tener el formato AAAA-MM-DD',
  invalidRange: 'La fecha final no puede ser anterior a la inicial',
} as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ListScheduleBlocksService {
  constructor(private readonly blocks: ScheduleBlockRepository) {}

  async listBlocks(filter: ScheduleBlockFilter): Promise<ScheduleBlockResponse[]> {
    const sucursalId = filter.sucursalId?.trim() || undefined;
    if (sucursalId && !UUID_PATTERN.test(sucursalId)) throw ApiException.badRequest(LIST_BLOCK_MESSAGES.invalidBranch);

    const desde = this.optionalDate(filter.desde);
    const hasta = this.optionalDate(filter.hasta);
    if (desde && hasta && hasta < desde) throw ApiException.badRequest(LIST_BLOCK_MESSAGES.invalidRange);

    const blocks = await this.blocks.listActive({ sucursalId, desde, hasta });
    return blocks.map(toScheduleBlockResponse);
  }

  async listVeterinarians(): Promise<{ id: string; nombre: string }[]> {
    const veterinarians = await this.blocks.listActiveVeterinarians();
    return veterinarians.map(({ id, person }) => ({ id, nombre: `${person.firstName} ${person.lastName}` }));
  }

  private optionalDate(value?: string): Date | undefined {
    const text = value?.trim();
    if (!text) return undefined;
    const date = parseDate(text);
    if (!date) throw ApiException.badRequest(LIST_BLOCK_MESSAGES.invalidDate);
    return date;
  }
}
