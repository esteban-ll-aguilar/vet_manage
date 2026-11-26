import { IsBoolean } from 'class-validator';

// Activar (true) o inactivar (false) una especie (HU-15).
export class ChangeSpeciesStatusDto {
  @IsBoolean({ message: 'Estado de especie no válido' })
  isActive!: boolean;
}
