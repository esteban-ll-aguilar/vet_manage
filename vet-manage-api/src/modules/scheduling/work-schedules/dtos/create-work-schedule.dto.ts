import { IsEnum, IsNotEmpty, IsString, Matches } from 'class-validator';

export const DIA_SEMANA_VALUES = [
  'LUNES',
  'MARTES',
  'MIERCOLES',
  'JUEVES',
  'VIERNES',
  'SABADO',
] as const;

export type DiaSemanaValue = (typeof DIA_SEMANA_VALUES)[number];

export class CreateWorkScheduleDto {
  @IsString()
  @IsNotEmpty({ message: 'El veterinario es obligatorio' })
  veterinarioId!: string;

  @IsString()
  @IsNotEmpty({ message: 'La sucursal es obligatoria' })
  sucursalId!: string;

  @IsEnum(DIA_SEMANA_VALUES, {
    message: `El día de la semana debe ser uno de: ${DIA_SEMANA_VALUES.join(', ')}`,
  })
  diaSemana!: DiaSemanaValue;

  @Matches(/^\d{2}:\d{2}$/, { message: 'La hora de inicio debe tener formato HH:mm' })
  @IsNotEmpty({ message: 'La hora de inicio es obligatoria' })
  horaInicio!: string;

  @Matches(/^\d{2}:\d{2}$/, { message: 'La hora de fin debe tener formato HH:mm' })
  @IsNotEmpty({ message: 'La hora de fin es obligatoria' })
  horaFin!: string;
}
