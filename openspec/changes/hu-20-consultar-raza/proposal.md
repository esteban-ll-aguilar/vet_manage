## Why

El catálogo de razas ya se puede registrar (HU-17) y actualizar (HU-18), y `GET /api/v1/pets/breeds` devuelve todas las razas, pero no hay forma de **buscarlas por nombre, filtrarlas por especie ni ver el detalle de una**. Con el catálogo creciendo, el Veterinario, la Recepcionista, el Técnico Veterinario y el Gerente necesitan localizar una raza rápido (**HU-20 · Consultar raza**, RF-22, Sprint 2).

Documentación funcional de referencia:
- `docs/modulo-1-historial-clinico/historias-usuario/03-especies-razas.md` (HU-20, RF-22)
- `docs/modulo-1-historial-clinico/matriz-roles-permisos.md` (sección 2.4: «Consultar razas» para Gerente, Veterinario, Técnico Veterinario y Recepcionista → permiso `breeds:read`)

## What Changes

- Ampliar `GET /api/v1/pets/breeds` con filtros opcionales `search` (nombre, sin distinguir mayúsculas ni tildes, coincidencia parcial) y `speciesId`, combinables. Sin filtros mantiene el comportamiento actual (todas las razas, orden alfabético), así no se rompe la pantalla existente.
- Nuevo `GET /api/v1/pets/breeds/:id` con el detalle de una raza: nombre, especie asociada, descripción y estado.
- Nuevo servicio `FindBreedsService` en `src/modules/pets/services/breeds/` (un servicio por operación) que reutiliza la normalización de búsqueda sin tildes de HU-06/HU-12.
- Frontend (`BreedsPage`): campo de búsqueda por nombre, filtro por especie (incluye especies inactivas, para poder consultar sus razas), mensaje «No se encontraron razas con el criterio ingresado» y panel de detalle de solo lectura al seleccionar una raza.
- **Auditoría:** HU-20 solo lee datos. Según la regla vigente de `audit-log` («Read operations are not audited»), la consulta de razas **no** crea registros de auditoría; se agrega un escenario que lo verifica.

## Capabilities

### New Capabilities
- `breed-query-ui`: Búsqueda por nombre, filtro por especie, mensaje sin resultados y detalle de solo lectura de una raza en `BreedsPage`, visible para los roles con `breeds:read`.

### Modified Capabilities
- `breed-catalog`: El listado general de razas acepta los filtros `search` y `speciesId`, y se agrega la consulta del detalle de una raza; ambas sin auditoría.

## Impact

- **Backend (`vet-manage-api`)**:
  - `src/modules/pets/routes/breed.controller.ts` (filtros y detalle) y su prueba.
  - `src/modules/pets/services/breeds/find-breeds.service.ts` (+ `.spec.ts`), nuevo DTO `dtos/breeds/list-breeds-query.dto.ts`.
  - `src/modules/pets/repositories/breed.repository.ts` (consulta con filtros).
  - Sin cambios de esquema ni de catálogo de auditoría.
- **Frontend (`vet-manage-frontend`)**: `src/modules/pets/pages/breeds-page.tsx`, `services/breed.service.ts`, `types.ts` y sus pruebas.
- **Permisos:** el Administrador no tiene acceso a las razas (matriz 2.4, ya aplicado en `development`); se fija con pruebas.
- Pruebas con casos positivos, negativos y de valor límite.
- **Fuera de alcance**: paginación (el catálogo de razas es pequeño); activar e inactivar razas (HU-19).
