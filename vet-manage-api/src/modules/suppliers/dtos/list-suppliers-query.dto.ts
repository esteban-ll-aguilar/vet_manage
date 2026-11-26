import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const toPositiveNumber = (fallback: number) => ({ value }: { value: unknown }) =>
  value === undefined || value === '' ? fallback : Number(value);

export type SupplierListStatus = 'ACTIVE' | 'INACTIVE';

export class ListSuppliersQueryDto {
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
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'], { message: 'status debe ser ACTIVE o INACTIVE' })
  status?: SupplierListStatus;
}
