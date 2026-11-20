import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import type { ClientStatus } from './client-response.dto.js';

const toPositiveNumber = (fallback: number) => ({ value }: { value: unknown }) =>
  value === undefined || value === '' ? fallback : Number(value);

const normalizeSearch = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export class ListClientsQueryDto {
  @IsOptional()
  @Transform(toPositiveNumber(1))
  @IsInt({ message: 'page debe ser un número entero' })
  @Min(1, { message: 'page debe ser mayor o igual a 1' })
  page = 1;

  @IsOptional()
  @Transform(toPositiveNumber(20))
  @IsInt({ message: 'pageSize debe ser un número entero entre 1 y 100' })
  @Min(1, { message: 'pageSize debe estar entre 1 y 100' })
  @Max(100, { message: 'pageSize debe estar entre 1 y 100' })
  pageSize = 20;

  @IsOptional()
  @Transform(normalizeSearch)
  @IsString()
  @MinLength(2, {
    message: 'Ingrese al menos 2 caracteres para buscar por nombre o los 10 dígitos de la cédula',
  })
  search?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'DEACTIVATED'], { message: 'status debe ser ACTIVE, INACTIVE o DEACTIVATED' })
  status?: ClientStatus;
}
