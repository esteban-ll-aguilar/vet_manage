export type PatientStatus = 'ACTIVE' | 'INACTIVE' | 'DEACTIVATED';
export type PatientGender = 'MALE' | 'FEMALE';
export type PatientReproductiveStatus = 'STERILIZED' | 'NOT_STERILIZED' | 'UNKNOWN';

export type PatientSearchItem = {
  id: string;
  code: string;
  name: string;
  gender: PatientGender;
  birthDate: string;
  weightKg: number;
  heightCm: number;
  reproductiveStatus: PatientReproductiveStatus;
  color: string | null;
  status: PatientStatus;
  client: {
    firstName: string;
    lastName: string;
    identification: string;
  };
  species: { id: string; name: string };
  breed: { id: string; name: string };
};

export type PatientSearchResponse = {
  items: PatientSearchItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
