import { Allow } from 'class-validator';

// Los campos se aceptan tal como llegan y se validan en validateBatchEntryInput,
// que devuelve el mensaje específico de cada campo exigido por HU-02
// (por ejemplo, distinguir cantidad vacía, cero/negativa y decimal/texto).
export class RegisterBatchEntryDto {
  @Allow()
  productId?: unknown;

  @Allow()
  code?: unknown;

  @Allow()
  expirationDate?: unknown;

  @Allow()
  initialQuantity?: unknown;
}
