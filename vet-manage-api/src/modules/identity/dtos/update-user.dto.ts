import { IsOptional } from 'class-validator';

// Datos editables del usuario (HU-53). El servicio valida y normaliza; aquí solo se declaran para el ValidationPipe.
export class UpdateUserDto {
  @IsOptional()
  firstName?: unknown;

  @IsOptional()
  lastName?: unknown;

  @IsOptional()
  email?: unknown;

  @IsOptional()
  phone?: unknown;

  // La cédula no se puede cambiar: se acepta para no rechazar el formulario completo, pero se ignora.
  @IsOptional()
  identification?: unknown;
}
