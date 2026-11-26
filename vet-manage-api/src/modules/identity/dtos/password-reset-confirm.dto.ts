import { IsOptional, IsString } from 'class-validator';

// El estado del enlace, los campos vacíos y la política de contraseñas los valida RecoverPasswordService.
export class PasswordResetConfirmDto {
  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsString()
  newPassword?: string;

  @IsOptional()
  @IsString()
  confirmPassword?: string;
}
