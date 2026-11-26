export const CLIENT_ROLE = 'client';

export type AssignableRole = { name: string; displayName: string; description: string | null };

export type RegisterClientInput = {
  identification: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: string;
  roles: string[];
};

export type ClientStatus = 'ACTIVE' | 'INACTIVE' | 'DEACTIVATED';

// Datos editables del cliente (HU-02); la cédula no se envía porque no se puede cambiar.
export type UpdateClientInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
};

export type UpdatedClient = {
  id: string;
  identification: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  address: string | null;
  status: ClientStatus;
};

export type InactivatedClient = {
  id: string;
  status: 'INACTIVE';
};

export type ActivatedClient = {
  id: string;
  status: 'ACTIVE';
};

// Baja definitiva (HU-03).
export type DeactivatedClient = {
  id: string;
  status: 'DEACTIVATED';
  deactivatedAt: string;
  deactivationReason: string;
};

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
  // Datos de la baja (HU-03); nulos si el cliente no está de baja.
  deactivatedAt?: string | null;
  deactivationReason?: string | null;
  deactivatedBy?: string | null;
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
