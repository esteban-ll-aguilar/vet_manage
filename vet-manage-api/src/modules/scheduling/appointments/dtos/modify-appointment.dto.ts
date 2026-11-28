import { IsNotEmpty, IsString, IsUUID, Matches } from 'class-validator';

export class ModifyAppointmentDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha debe tener formato YYYY-MM-DD' })
  @IsNotEmpty({ message: 'La fecha es obligatoria' })
  fecha!: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'La hora debe tener formato HH:mm' })
  @IsNotEmpty({ message: 'La hora de inicio es obligatoria' })
  horaInicio!: string;

  @IsUUID(undefined, { message: 'Seleccione un veterinario' })
  @IsNotEmpty({ message: 'El veterinario es obligatorio' })
  veterinarioId!: string;

  @IsUUID(undefined, { message: 'Seleccione un consultorio' })
  @IsNotEmpty({ message: 'El consultorio es obligatorio' })
  salaId!: string;
}
