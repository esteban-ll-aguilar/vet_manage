import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';
import { APPOINTMENT_MESSAGES } from '../appointment-messages.js';

export class RegisterAppointmentDto {
  @IsUUID()
  @IsNotEmpty({ message: 'La sucursal es obligatoria' })
  sucursalId!: string;

  @IsUUID()
  @IsNotEmpty({ message: 'El cliente es obligatorio' })
  clienteId!: string;

  @IsUUID()
  @IsNotEmpty({ message: 'El paciente es obligatorio' })
  pacienteId!: string;

  @IsUUID()
  @IsNotEmpty({ message: 'El servicio es obligatorio' })
  servicioId!: string;

  @IsUUID()
  @IsNotEmpty({ message: 'El veterinario es obligatorio' })
  veterinarioId!: string;

  @IsUUID()
  @IsNotEmpty({ message: 'El consultorio es obligatorio' })
  salaId!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha debe tener formato YYYY-MM-DD',
  })
  @IsNotEmpty({ message: 'La fecha es obligatoria' })
  fecha!: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'La hora debe tener formato HH:mm',
  })
  @IsNotEmpty({ message: 'La hora de inicio es obligatoria' })
  horaInicio!: string;

  @Type(() => Number)
  @IsNotEmpty({ message: 'La duración es obligatoria' })
  @IsInt({ message: APPOINTMENT_MESSAGES.invalidDuration })
  @Min(30, { message: APPOINTMENT_MESSAGES.invalidDuration })
  duracionMin!: number;
}
