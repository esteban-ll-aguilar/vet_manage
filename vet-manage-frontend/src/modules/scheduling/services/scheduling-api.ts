import { getJson } from '../../../infrastructure/api/http-client';
import type { Branch, ClinicService } from '../types';

export const schedulingApi = {
  listBranches() {
    return getJson<Branch[]>('/scheduling/branches');
  },
  listServices() {
    return getJson<ClinicService[]>('/scheduling/services');
  },
};
