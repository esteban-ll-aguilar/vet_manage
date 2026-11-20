export type AssignableRole = { name: string; displayName: string; description: string | null };

export type RegisterUserInput = {
  identification: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  roles: string[];
};

export type RegisteredUser = {
  id: string;
  identification: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: { name: string; displayName: string }[];
  existingPerson: boolean;
  passwordAssigned: boolean;
  credentialsSent: boolean;
};

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'DEACTIVATED';

export type UserListItem = {
  id: string;
  identification: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: { name: string; displayName: string }[];
  status: UserStatus;
};

export type UserQuery = {
  q?: string;
  role?: string;
  status?: UserStatus;
  page?: number;
  pageSize?: number;
};

export type UserPage = {
  items: UserListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type RoleRef = { name: string; displayName: string };

export type UserRoleAssignment = {
  user: { id: string; status: UserStatus | string; fullName: string };
  currentRoles: RoleRef[];
  availableRoles: RoleRef[];
};
