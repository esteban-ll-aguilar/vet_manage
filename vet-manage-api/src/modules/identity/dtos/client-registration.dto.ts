import { IsOptional, IsString, IsArray } from 'class-validator';

export class ClientRegistrationDto {
  @IsString()
  identification: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  // Se acepta por compatibilidad con clientes existentes; el servicio asigna siempre el rol `client`.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];
}

export class ClientResponseDto {
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
}
