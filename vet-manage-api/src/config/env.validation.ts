import { Type, plainToInstance } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUrl, Min, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  PORT = 3080;

  @IsString()
  DATABASE_URL!: string;

  @IsOptional()
  @IsUrl({ protocols: ['redis'], require_tld: false })
  REDIS_URL = 'redis://redis:56379';

  @IsOptional()
  @IsUrl({ protocols: ['amqp', 'amqps'], require_tld: false })
  RABBITMQ_URL = 'amqp://vetmanage:vetmanage_dev_password@rabbitmq:55672';
}

export function validateEnvironment(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration: ${errors.toString()}`);
  }

  return validated;
}
