import { IsOptional, IsString } from 'class-validator';

// El formato del correo lo valida RecoverPasswordService para responder con el mensaje de HU-58.
export class PasswordResetRequestDto {
  @IsOptional()
  @IsString()
  email?: string;
}
