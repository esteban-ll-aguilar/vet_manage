import { IsUUID, ValidateBy, type ValidationArguments } from 'class-validator';

export const INVALID_RATE_MESSAGE = 'Ingrese un importe mayor a cero con hasta dos decimales';
export const REQUIRED_RATE_MESSAGE = 'El campo tarifa es obligatorio';

export const validRateAmount = {
  name: 'validRateAmount',
  validator: {
    validate(value: unknown) {
      if (value === '' || value === null || value === undefined) return false;
      if (typeof value !== 'number' || !Number.isFinite(value)) return false;
      if (value <= 0) return false;
      const hundredths = value * 100;
      return Math.abs(hundredths - Math.round(hundredths)) < 1e-8;
    },
    defaultMessage: (args: ValidationArguments) => args.value === '' || args.value === null || args.value === undefined
      ? REQUIRED_RATE_MESSAGE
      : INVALID_RATE_MESSAGE,
  },
};

export class CreateRateDto {
  @IsUUID()
  servicioId!: string;

  @IsUUID()
  sucursalId!: string;

  @ValidateBy(validRateAmount)
  importe!: number;
}
