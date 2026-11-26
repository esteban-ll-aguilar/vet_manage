import { IsOptional, IsString } from 'class-validator';

export class QueryWorkSchedulesDto {
  @IsOptional()
  @IsString()
  veterinarioId?: string;

  @IsOptional()
  @IsString()
  sucursalId?: string;
}
