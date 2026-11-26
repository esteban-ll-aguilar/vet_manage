import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export const BREED_QUERY_MESSAGES = {
  searchTooLong: 'La búsqueda no puede superar 100 caracteres',
  invalidSpecies: 'Especie no válida',
} as const;

export const BREED_SEARCH_MAX = 100;

// Un valor vacío o solo con espacios se trata como "sin filtro".
const blankToUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

// Filtros opcionales y combinables del listado de razas (HU-20).
export class ListBreedsQueryDto {
  @IsOptional()
  @Transform(blankToUndefined)
  @IsString()
  @MaxLength(BREED_SEARCH_MAX, { message: BREED_QUERY_MESSAGES.searchTooLong })
  search?: string;

  @IsOptional()
  @Transform(blankToUndefined)
  @IsUUID('all', { message: BREED_QUERY_MESSAGES.invalidSpecies })
  speciesId?: string;
}
