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
export type ChangeableUserStatus = 'ACTIVE' | 'INACTIVE';

export type ChangedUserStatus = {
  id: string;
  status: ChangeableUserStatus;
};

export type DeactivatedUserResult = {
  id: string;
  status: UserStatus;
  deactivatedAt: string | null;
  deactivationReason: string | null;
  roles: RoleRef[];
};

export type UserListItem = {
  id: string;
  identification: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: { name: string; displayName: string }[];
  status: UserStatus;
};

// Datos de un usuario para su ficha y su formulario de edición (HU-53).
export type UserDetail = {
  id: string;
  identification: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  deactivatedAt?: string | null;
  deactivationReason?: string | null;
  roles: RoleRef[];
};

// La cédula no se envía porque no se puede cambiar.
export type UpdateUserInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

// noticeSent: true o false si el correo cambió y se intentó avisar al anterior; null si el correo no cambió.
export type UpdatedUser = UserDetail & { noticeSent: boolean | null };

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
