import { ValidateBy } from 'class-validator';
import { validRateAmount } from './create-rate.dto.js';

export class UpdateRateDto {
  @ValidateBy(validRateAmount)
  importe!: number;
}
