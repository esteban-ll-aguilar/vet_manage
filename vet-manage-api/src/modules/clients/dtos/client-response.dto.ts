export type ClientStatus = 'ACTIVE' | 'INACTIVE' | 'DEACTIVATED';

export type ClientRole = { name: string; displayName: string };

export class ClientResponseDto {
  id: string;
  personId: string;
  identification: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  address: string | null;
  status: ClientStatus;
  roles: ClientRole[];
  createdAt: string;
  // Datos de la baja (HU-03); nulos si el cliente no está de baja.
  deactivatedAt: string | null;
  deactivationReason: string | null;
  deactivatedBy: string | null;
}

export class ClientListResponseDto {
  items: ClientResponseDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type ClientPetDto = {
  id: string;
  code: string;
  name: string;
  species: string;
  breed: string;
  status: ClientStatus;
};
