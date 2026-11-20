export const CLIENT_ROLE = 'client';

export type AssignableRole = { name: string; displayName: string; description: string | null };

export type RegisterClientInput = {
  identification: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  roles: string[];
};

export type ClientStatus = 'ACTIVE' | 'INACTIVE' | 'DEACTIVATED';

export type ClientListItem = {
  id: string;
  personId: string;
  identification: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  address: string | null;
  status: ClientStatus;
  roles: { name: string; displayName: string }[];
  createdAt: string;
};

export type ClientPet = {
  id: string;
  code: string;
  name: string;
  species: string;
  breed: string;
  status: ClientStatus;
};

export type ClientQuery = {
  search?: string;
  status?: ClientStatus;
  page?: number;
  pageSize?: number;
};

export type ClientPage = {
  items: ClientListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type RegisteredClient = {
  id: string;
  personId: string;
  identification: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  address: string | null;
  status: string;
  roles: { name: string; displayName: string }[];
  existingPerson: boolean;
  passwordAssigned: boolean;
  credentialsSent: boolean;
};
