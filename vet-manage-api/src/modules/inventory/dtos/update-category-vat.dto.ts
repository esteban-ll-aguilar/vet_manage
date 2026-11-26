import { IsString, Matches } from 'class-validator';

export const CATEGORY_VAT_RATE_PATTERN = /^(?:0*\d{1,2}(?:\.\d{1,2})?|0*100(?:\.0{1,2})?)$/;

export class UpdateCategoryVatDto {
  @IsString({ message: 'El IVA debe enviarse como cadena decimal' })
  @Matches(CATEGORY_VAT_RATE_PATTERN, {
    message: 'El IVA debe ser un porcentaje entre 0 y 100 con hasta dos decimales',
  })
  vatRate!: string;
}
