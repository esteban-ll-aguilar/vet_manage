import { Transform, Type, plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  MinLength,
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
  validateSync,
} from 'class-validator';
import { isValidIdentification } from '../common/validation/identification.js';
import { PASSWORD_PATTERN, PASSWORD_POLICY_MESSAGE } from '../common/security/password-policy.js';

@ValidatorConstraint({ name: 'identification' })
class IdentificationConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return typeof value === 'string' && isValidIdentification(value);
  }

  defaultMessage() {
    return 'ADMIN_IDENTIFICATION debe ser una cédula ecuatoriana válida de 10 dígitos';
  }
}

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

  @IsString()
  @MinLength(32)
  JWT_SECRET!: string;

  @IsOptional()
  @Matches(/^\d+[smhd]$/, { message: 'JWT_EXPIRES_IN debe tener formato como 15m, 1h o 7d' })
  JWT_EXPIRES_IN = '15m';

  @IsOptional()
  @Matches(/^\d+[smhd]$/, { message: 'SESSION_EXPIRES_IN debe tener formato como 8h, 12h o 7d' })
  SESSION_EXPIRES_IN = '12h';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  PASSWORD_RESET_TTL_MINUTES = 30;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  APP_URL = 'http://localhost:5174';

  @IsOptional()
  @IsString()
  SMTP_HOST = 'mailpit';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  SMTP_PORT = 51025;

  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  SMTP_SECURE = false;

  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @IsOptional()
  @IsString()
  SMTP_PASSWORD?: string;

  // Remitente: "correo@dominio" o "Nombre <correo@dominio>".
  @IsOptional()
  @Matches(/^(?:[^<>@\r\n]+<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>|[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)$/, {
    message: 'MAIL_FROM debe ser una dirección como correo@dominio o Nombre <correo@dominio>',
  })
  MAIL_FROM = 'VetManage <no-reply@vetmanage.local>';

  @IsOptional()
  @IsIn(['create-only', 'strict'])
  RBAC_SYNC_MODE = 'create-only';

  @IsEmail()
  @MaxLength(255)
  ADMIN_EMAIL!: string;

  @Matches(PASSWORD_PATTERN, { message: PASSWORD_POLICY_MESSAGE })
  ADMIN_PASSWORD!: string;

  @Validate(IdentificationConstraint)
  ADMIN_IDENTIFICATION!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  ADMIN_FIRST_NAME!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  ADMIN_LAST_NAME!: string;
}

export function validateEnvironment(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, {
    skipMissingProperties: false,
    validationError: { target: false, value: false },
  });

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration: ${errors.toString()}`);
  }

  return validated;
}
