import { IsOptional } from 'class-validator';

// Los tipos y formatos los valida el servicio, para responder con los mensajes de la HU.
export class UpdateClientDto {
  @IsOptional()
  firstName?: unknown;

  @IsOptional()
  lastName?: unknown;

  @IsOptional()
  email?: unknown;

  @IsOptional()
  phone?: unknown;

  @IsOptional()
  address?: unknown;

  // La cédula no se puede cambiar: se acepta para no rechazar el formulario y el servicio la ignora.
  @IsOptional()
  identification?: unknown;
}
