import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSpeciesDto {
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre de la especie es obligatorio' })
  @MaxLength(100, { message: 'El nombre no puede exceder los 100 caracteres' })
  name!: string;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  description?: string | null;
}
