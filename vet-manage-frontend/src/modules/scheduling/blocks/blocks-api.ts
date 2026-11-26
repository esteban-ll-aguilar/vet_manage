import { getJson, patchJson, postJson } from '../../../infrastructure/api/http-client';
import type { ScheduleBlock, ScheduleBlockDraft, Veterinarian } from './types';

export const blocksApi = {
  list(sucursalId: string) {
    const query = sucursalId ? `?sucursalId=${encodeURIComponent(sucursalId)}` : '';
    return getJson<ScheduleBlock[]>(`/scheduling/schedule-blocks${query}`);
  },
  listVeterinarians() {
    return getJson<Veterinarian[]>('/scheduling/schedule-blocks/veterinarians');
  },
  create(draft: ScheduleBlockDraft) {
    return postJson<ScheduleBlock, ScheduleBlockDraft>('/scheduling/schedule-blocks', draft);
  },
  remove(id: string) {
    return patchJson<{ id: string; fechaEliminacion: string }, Record<string, never>>(
      `/scheduling/schedule-blocks/${encodeURIComponent(id)}/remove`,
      {},
    );
  },
};
