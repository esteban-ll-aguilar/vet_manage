import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { DIA_SEMANA_VALUES, type DiaSemanaValue } from './create-work-schedule.dto.js';

export class UpdateWorkScheduleDto {
  @IsOptional()
  @IsString()
  veterinarioId?: string;

  @IsOptional()
  @IsString()
  sucursalId?: string;

  @IsOptional()
  @IsEnum(DIA_SEMANA_VALUES, {
    message: `El día de la semana debe ser uno de: ${DIA_SEMANA_VALUES.join(', ')}`,
  })
  diaSemana?: DiaSemanaValue;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'La hora de inicio debe tener formato HH:mm' })
  horaInicio?: string;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'La hora de fin debe tener formato HH:mm' })
  horaFin?: string;
}
