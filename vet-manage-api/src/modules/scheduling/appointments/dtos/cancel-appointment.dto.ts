import { IsString } from 'class-validator';

export class CancelAppointmentDto {
  @IsString({ message: 'Ingrese el motivo de cancelación' })
  motivo!: string;
}