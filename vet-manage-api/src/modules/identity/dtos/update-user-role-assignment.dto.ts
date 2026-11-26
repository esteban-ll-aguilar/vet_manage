import { IsArray, IsOptional, IsString } from 'class-validator';

// La normalización y los mensajes de negocio los resuelve el servicio.
export class UpdateUserRoleAssignmentDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];
}
