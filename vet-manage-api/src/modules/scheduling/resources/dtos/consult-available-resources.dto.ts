
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class ConsultAvailableResourcesDto {
  @IsString()
  @IsNotEmpty({ message: 'La sucursal es obligatoria' })
  sucursalId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha debe tener formato YYYY-MM-DD',
  })
  @IsNotEmpty({ message: 'La fecha es obligatoria' })
  fecha!: string;

  @Matches(/^\d{2}:\d{2}$/, {
    message: 'La hora debe tener formato HH:mm',
  })
  @IsNotEmpty({ message: 'La hora es obligatoria' })
  hora!: string;

  @Type(() => Number)
  @IsInt({ message: 'La duración debe ser un número entero' })
  @Min(30, { message: 'La duración mínima es de 30 minutos' })
  duracionMin!: number;
}
