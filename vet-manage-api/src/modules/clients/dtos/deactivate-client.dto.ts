import { IsOptional, IsString } from 'class-validator';

// El motivo obligatorio y su longitud los valida ChangeClientStatusService para responder
// con los mensajes de la HU-03; aquí solo se permite el campo.
export class DeactivateClientDto {
  @IsOptional()
  @IsString({ message: 'Ingrese el motivo de la baja' })
  reason?: string;
}
