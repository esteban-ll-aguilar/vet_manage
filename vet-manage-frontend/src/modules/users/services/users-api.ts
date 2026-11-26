import { getJson, patchJson, postJson, putJson } from '../../../infrastructure/api/http-client';
import type {
  AssignableRole,
  ChangeableUserStatus,
  ChangedUserStatus,
  DeactivatedUserResult,
  RegisteredUser,
  RegisterUserInput,
  UpdatedUser,
  UpdateUserInput,
  UserDetail,
  UserPage,
  UserQuery,
  UserRoleAssignment,
} from '../types';

export const usersApi = {
  assignableRoles() {
    return getJson<AssignableRole[]>('/users/assignable-roles');
  },
  list(query: UserQuery = {}) {
    const params = new URLSearchParams();
    const values: [string, string | undefined][] = [
      ['q', query.q?.trim()],
      ['role', query.role?.trim()],
      ['status', query.status],
      ['page', query.page === undefined ? undefined : String(query.page)],
      ['pageSize', query.pageSize === undefined ? undefined : String(query.pageSize)],
    ];

    for (const [key, value] of values) {
      if (value) params.set(key, value);
    }

    const suffix = params.toString();
    return getJson<UserPage>(`/users${suffix ? `?${suffix}` : ''}`);
  },
  register(input: RegisterUserInput) {
    return postJson<RegisteredUser, RegisterUserInput>('/users', input);
  },
  get(userId: string) {
    return getJson<UserDetail>(`/users/${userId}`);
  },
  update(userId: string, input: UpdateUserInput) {
    return patchJson<UpdatedUser, UpdateUserInput>(`/users/${userId}`, input);
  },
  getRoleAssignment(userId: string) {
    return getJson<UserRoleAssignment>(`/users/${userId}/role-assignment`);
  },
  updateRoleAssignment(userId: string, roles: string[]) {
    return putJson<UserRoleAssignment, { roles: string[] }>(`/users/${userId}/role-assignment`, { roles });
  },
  changeStatus(userId: string, status: ChangeableUserStatus) {
    return patchJson<ChangedUserStatus, { status: ChangeableUserStatus }>(`/users/${userId}/status`, { status });
  },
  deactivate(userId: string, reason: string) {
    return patchJson<DeactivatedUserResult, { reason: string }>(`/users/${userId}/deactivate`, { reason });
  },
};
