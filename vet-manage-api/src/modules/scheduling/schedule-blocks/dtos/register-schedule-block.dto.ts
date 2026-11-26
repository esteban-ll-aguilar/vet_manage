import { IsOptional } from 'class-validator';

// Los datos se validan en validateScheduleBlockInput para responder con los mensajes del formulario.
// @IsOptional solo marca las propiedades como permitidas por el ValidationPipe (whitelist).
export class RegisterScheduleBlockDto {
  @IsOptional() sucursalId?: unknown;
  // VETERINARIO o SUCURSAL.
  @IsOptional() alcance?: unknown;
  @IsOptional() veterinarioId?: unknown;
  // AAAA-MM-DD
  @IsOptional() fecha?: unknown;
  // HH:mm
  @IsOptional() horaInicio?: unknown;
  @IsOptional() horaFin?: unknown;
  @IsOptional() motivo?: unknown;
}
