import { Allow } from 'class-validator';

export class UpdateBatchExpirationDto {
  @Allow()
  expirationDate?: unknown;
}
