export type ManagedPermission = {
  key: string;
  module: string;
  action: string;
  displayName: string;
  description: string | null;
};

export type ManagedRole = {
  id: string;
  name: string;
  displayName: string;
  category: string;
  permissionKeys: string[];
};

export type RolePermissionsCatalog = {
  roles: ManagedRole[];
  permissions: ManagedPermission[];
  protectedPermissionKeys: string[];
};
