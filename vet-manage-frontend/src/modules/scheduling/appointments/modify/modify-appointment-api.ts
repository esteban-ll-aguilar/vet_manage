import { getJson, patchJson } from '../../../../infrastructure/api/http-client';
import type { AppointmentChangeDraft, AppointmentDetail, ModifiedAppointment } from './types';

const path = (id: string) => `/scheduling/appointments/${encodeURIComponent(id)}`;

export const modifyAppointmentApi = {
  detail(id: string) {
    return getJson<AppointmentDetail>(path(id));
  },
  modify(id: string, draft: AppointmentChangeDraft) {
    return patchJson<ModifiedAppointment, AppointmentChangeDraft>(path(id), draft);
  },
};
