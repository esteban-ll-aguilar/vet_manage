import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export enum QueryUserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DEACTIVATED = 'DEACTIVATED',
}

export class QueryUsersDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  role?: string;

  @IsOptional()
  @IsEnum(QueryUserStatus)
  status?: QueryUserStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsIn([20])
  pageSize?: number;
}
