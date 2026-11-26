import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class ListProductsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  brandName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  batchCode?: string;

  @IsOptional()
  @Matches(/^\d{1,10}(?:\.\d{1,2})?$/, {
    message: 'El precio unitario debe ser un decimal con hasta dos decimales',
  })
  unitPrice?: string;
}
