import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { SUPPLIER_RUC_FORMAT_MESSAGE, SUPPLIER_RUC_PATTERN } from '../ruc-validation.js';

const trimString = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateSupplierDto {
  @Transform(trimString)
  @IsString({ message: 'La razón social debe ser texto' })
  @IsNotEmpty({ message: 'La razón social es obligatoria' })
  businessName!: string;

  @Transform(trimString)
  @IsString({ message: 'El RUC debe ser texto' })
  @IsNotEmpty({ message: 'El RUC es obligatorio' })
  @Matches(SUPPLIER_RUC_PATTERN, { message: SUPPLIER_RUC_FORMAT_MESSAGE })
  ruc!: string;
}
