import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CatalogReferenceDto } from './catalog-reference.dto.js';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  unitPrice!: number;

  @ValidateNested()
  @Type(() => CatalogReferenceDto)
  category!: CatalogReferenceDto;

  @ValidateNested()
  @Type(() => CatalogReferenceDto)
  brand!: CatalogReferenceDto;
}
