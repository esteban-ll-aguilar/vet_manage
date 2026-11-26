import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, ValidateIf } from 'class-validator';
import { SUPPLIER_RUC_FORMAT_MESSAGE, SUPPLIER_RUC_PATTERN } from '../ruc-validation.js';

const trimString = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const provided = (_object: object, value: unknown) => value !== undefined;

export class UpdateSupplierDto {
  @ValidateIf(provided)
  @Transform(trimString)
  @IsString({ message: 'La razón social debe ser texto' })
  @IsNotEmpty({ message: 'La razón social no puede estar vacía' })
  businessName?: string;

  @ValidateIf(provided)
  @Transform(trimString)
  @IsString({ message: 'El RUC debe ser texto' })
  @IsNotEmpty({ message: 'El RUC no puede estar vacío' })
  @Matches(SUPPLIER_RUC_PATTERN, { message: SUPPLIER_RUC_FORMAT_MESSAGE })
  ruc?: string;
}
