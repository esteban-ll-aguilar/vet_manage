import { getJson, patchJson } from '../../../infrastructure/api/http-client';

import type {
  Appointment,
  CancelAppointmentDraft,
  CancelledAppointment,
} from './types';

export const appointmentsApi = {
  list() {
    return getJson<Appointment[]>(
      '/scheduling/appointments',
    );
  },

  cancel(id: string, motivo: string) {
    return patchJson<
      CancelledAppointment,
      CancelAppointmentDraft
    >(
      `/scheduling/appointments/${encodeURIComponent(id)}/cancel`,
      { motivo },
    );
  },
};
