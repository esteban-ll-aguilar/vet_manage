import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

export class AvailabilitySlotDto {
  @Matches(/^\d{2}:\d{2}$/, { message: 'La hora de inicio debe tener formato HH:mm' })
  @IsNotEmpty({ message: 'La hora de inicio es obligatoria' })
  horaInicio!: string;

  @Matches(/^\d{2}:\d{2}$/, { message: 'La hora de fin debe tener formato HH:mm' })
  @IsNotEmpty({ message: 'La hora de fin es obligatoria' })
  horaFin!: string;
}

export class SaveDailyAvailabilityDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha debe tener formato YYYY-MM-DD' })
  @IsNotEmpty({ message: 'La fecha es obligatoria' })
  fecha!: string;

  @IsString()
  @IsNotEmpty({ message: 'La jornada es obligatoria' })
  horarioBaseId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilitySlotDto)
  franjas!: AvailabilitySlotDto[];
}
