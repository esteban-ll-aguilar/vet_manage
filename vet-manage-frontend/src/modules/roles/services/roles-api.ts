import { getJson, putJson } from '../../../infrastructure/api/http-client';
import type { ManagedRole, RolePermissionsCatalog } from '../types';

export const rolesApi = {
  permissionCatalog() {
    return getJson<RolePermissionsCatalog>('/roles/permissions');
  },
  updatePermissions(roleId: string, permissionKeys: string[]) {
    return putJson<ManagedRole, { permissionKeys: string[] }>(
      `/roles/${roleId}/permissions`,
      { permissionKeys },
    );
  },
};
