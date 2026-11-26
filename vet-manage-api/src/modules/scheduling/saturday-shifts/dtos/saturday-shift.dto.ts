import { ArrayNotEmpty, IsArray, IsNotEmpty, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SaturdayAssignmentDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha debe tener formato YYYY-MM-DD' })
  fecha!: string;

  @IsString()
  @IsNotEmpty({ message: 'El veterinario es obligatorio' })
  veterinarioId!: string;

  @IsOptional()
  @IsString()
  sucursalId?: string;
}

export class GenerateSaturdayShiftsDto {
  @IsString()
  @IsNotEmpty({ message: 'La sucursal es obligatoria' })
  sucursalId!: string;

  @IsArray()
  @ArrayNotEmpty({ message: 'Debe indicar al menos una fecha' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { each: true, message: 'La fecha debe tener formato YYYY-MM-DD' })
  fechas!: string[];

  @IsArray()
  @ArrayNotEmpty({ message: 'Debe indicar veterinarios elegibles' })
  @IsString({ each: true })
  veterinarioIds!: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaturdayAssignmentDto)
  asignaciones?: SaturdayAssignmentDto[];
}

export class SubstituteSaturdayShiftDto {
  @IsString()
  @IsNotEmpty({ message: 'El veterinario es obligatorio' })
  veterinarioId!: string;

  @IsString()
  @IsNotEmpty({ message: 'La justificación es obligatoria' })
  justificacion!: string;
}
