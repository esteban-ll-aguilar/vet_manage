import { IsOptional } from 'class-validator';

// Motivo de baja definitiva (HU-61). El servicio valida y normaliza; aquí se declara para el ValidationPipe.
export class DeactivateUserDto {
  @IsOptional()
  reason?: unknown;
}
