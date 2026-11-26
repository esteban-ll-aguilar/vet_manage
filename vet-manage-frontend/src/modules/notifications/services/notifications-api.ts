import { getJson, patchJson } from '../../../infrastructure/api/http-client';
import type { Notification, RelatedRecord } from '../types';

export const notificationsApi = {
  list(unreadOnly = false) {
    return getJson<Notification[]>(`/notifications${unreadOnly ? '?unreadOnly=true' : ''}`);
  },
  unreadCount() {
    return getJson<{ unreadCount: number }>('/notifications/unread-count');
  },
  markAsRead(id: string) {
    return patchJson<Notification, Record<string, never>>(`/notifications/${id}/read`, {});
  },
  relatedRecord(id: string) {
    return getJson<RelatedRecord>(`/notifications/${id}/related-record`);
  },
};
