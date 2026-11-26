import { Injectable } from '@nestjs/common';
import { ApiException } from '../../../../common/errors/api-exception.js';
import { ScheduleBlockRepository } from '../repositories/schedule-block.repository.js';

export const REMOVE_BLOCK_MESSAGES = {
  notFound: 'El bloqueo ya no existe',
} as const;

export type RemovedScheduleBlock = { id: string; fechaEliminacion: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class RemoveScheduleBlockService {
  constructor(private readonly blocks: ScheduleBlockRepository) {}

  // Elimina de forma lógica solo el bloqueo indicado y guarda quién lo eliminó.
  // No toca citas ni otros bloqueos, aunque afecten el mismo horario.
  async execute(id: string, actorId: string, now = new Date()): Promise<RemovedScheduleBlock> {
    if (!UUID_PATTERN.test(id)) throw this.notFound();

    const removed = await this.blocks.softDelete(id, actorId, now);
    // Ya eliminado por otra persona o inexistente: se informa sin eliminar nada más.
    if (removed === 0) throw this.notFound();

    return { id, fechaEliminacion: now.toISOString() };
  }

  private notFound() {
    return new ApiException(REMOVE_BLOCK_MESSAGES.notFound, 404, [], 'SCHEDULE_BLOCK_NOT_FOUND');
  }
}
