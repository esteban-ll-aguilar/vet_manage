export interface Species {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterSpeciesDraft {
  name: string;
  description?: string;
}

export interface SpeciesOption {
  id: string;
  name: string;
}

export interface Breed {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  speciesId: string;
  species?: SpeciesOption;
  createdAt: string;
  updatedAt: string;
}

export type BreedStatusChange = Pick<Breed, 'id' | 'isActive' | 'updatedAt'>;

export interface RegisterBreedDraft {
  name: string;
  speciesId: string;
  description?: string;
}

export type Gender = 'MALE' | 'FEMALE';
export type ReproductiveStatus = 'STERILIZED' | 'NOT_STERILIZED' | 'UNKNOWN';

export const GENDER_LABELS: Record<Gender, string> = { MALE: 'Macho', FEMALE: 'Hembra' };
export const REPRODUCTIVE_STATUS_LABELS: Record<ReproductiveStatus, string> = {
  STERILIZED: 'Esterilizado',
  NOT_STERILIZED: 'No esterilizado',
  UNKNOWN: 'Desconocido',
};

// Lo que el formulario envía a POST /pets. El código no se envía: lo asigna el backend.
export interface RegisterPatientDraft {
  name: string;
  speciesId: string;
  breedId: string;
  gender: Gender;
  birthDate: string;
  weightKg: number;
  heightCm: number;
  reproductiveStatus: ReproductiveStatus;
  color?: string;
  clientId: string;
}

export interface RegisteredPatient {
  id: string;
  code: string;
  name: string;
  gender: Gender;
  birthDate: string;
  weightKg: number;
  heightCm: number;
  reproductiveStatus: ReproductiveStatus;
  color: string | null;
  status: string;
  clientId: string;
  species: SpeciesOption;
  breed: SpeciesOption;
  createdAt: string;
}

// Cliente activo que se puede elegir como dueño del paciente.
export interface ClientOption {
  id: string;
  identification: string;
  firstName: string;
  lastName: string;
}

export type PatientStatus = 'ACTIVE' | 'INACTIVE' | 'DEACTIVATED';

export interface PatientQuery {
  search?: string;
  page?: number;
  pageSize?: number;
}

// Fila devuelta por GET /pets (HU-12). El cliente se aplana desde client.person.
export interface PatientSearchItem {
  id: string;
  code: string;
  name: string;
  gender: Gender;
  birthDate: string;
  weightKg: number;
  heightCm: number;
  reproductiveStatus: ReproductiveStatus;
  color: string | null;
  status: PatientStatus;
  client: {
    firstName: string;
    lastName: string;
    identification: string;
  };
  species: SpeciesOption;
  breed: SpeciesOption;
}

export interface PatientSearchResponse {
  items: PatientSearchItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
