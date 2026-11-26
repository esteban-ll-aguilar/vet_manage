import { IsOptional, IsString } from 'class-validator';

// Las reglas y mensajes exactos de HU-59 los valida ChangePasswordService.
export class ChangePasswordDto {
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsOptional()
  @IsString()
  newPassword?: string;

  @IsOptional()
  @IsString()
  confirmPassword?: string;
}
