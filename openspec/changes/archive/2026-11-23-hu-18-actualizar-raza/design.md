## Context

El módulo `pets` (catálogo de razas) en `vet-manage-api` ya cuenta con:
- Modelo `Breed` (`id`, `name`, `description`, `isActive`, `speciesId`, `species`, `createdAt`, `updatedAt`) con relación `species` (`Species`) y restricción única por `(speciesId, name)`.
- Permisos en `clinical.permissions.ts`: `breeds:create`, `breeds:read`, `breeds:update`, `breeds:change-status` (el rol `veterinarian` ya tiene `breeds:update` en `roles.catalog.ts`).
- `BreedRepository` (`findByNameInSpecies`, `findById`, `findActiveBySpecies`, `create`), `RegisterBreedService`, `ListActiveBreedsService` y `BreedController` (`POST /pets/breeds`, `GET /pets/species/:speciesId/breeds`).
- En `vet-manage-frontend`, `BreedsPage` (`src/modules/pets/pages/breeds-page.tsx`) ya cuenta con modal de registro reutilizando `BreedForm` (`src/modules/pets/components/breed-form.tsx`), `speciesApi.listActiveSpecies()` y `useToast()`.

## Goals / Non-Goals

**Goals:**
- Garantizar `update: 'Actualizar'` en `AUDIT_ACTIONS` (`src/modules/audit/audit.catalog.ts`).
- Exponer `GET /api/v1/pets/breeds` (`breeds:read`) devolviendo el listado completo de razas registradas con su especie asociada (`species: { id, name }`) ordenadas alfabéticamente por nombre.
- Exponer `PATCH /api/v1/pets/breeds/:id` (`breeds:update`, `ParseUUIDPipe`) con `UpdateBreedService` validando existencia de la raza (`404`), nombre obligatorio (`400`), especie asociada obligatoria y existente (`400`/`404`), especie activa al reasignar (`409`), descripción opcional de hasta 500 caracteres (`400`/`null`), unicidad de nombre en la especie destino excluyendo la propia raza (`409`), conservación íntegra de pacientes e historias clínicas asociadas, y auditoría atómica (`Actualizar`, módulo `Razas`, `previousValue`/`newValue`, sin duplicar auditoría si no hubo cambios).
- Actualizar `BreedsPage` y `BreedForm` para listar razas en una tabla a ancho completo (misma línea visual de Catálogos), mostrar el botón de icono **Editar** con tooltip solo con `breeds:update`, prellenar el modal con los datos actuales (incluyendo la especie actual si estuviera inactiva), descartar cambios al cancelar y mostrar toast `"Raza actualizada exitosamente"`.

**Non-Goals:**
- Activar e inactivar razas (`breeds:change-status`): corresponde a **HU-19**.
- Buscador por nombre y filtro por especie en `BreedsPage`: corresponde a **HU-20**.
- Migraciones de base de datos: no se requieren cambios en `prisma/schema/`.

## Decisions

1. **Endpoint `PATCH /api/v1/pets/breeds/:id` + listado base `GET /api/v1/pets/breeds`**
   - *Decisión:* Exponer `PATCH /pets/breeds/:id` (`ParseUUIDPipe`, `@RequirePermissions('breeds:update')`) y `GET /pets/breeds` (`@RequirePermissions('breeds:read')`) devolviendo `{ id, name, description, isActive, speciesId, species: { id, name }, createdAt, updatedAt }[]` ordenadas por nombre.
   - *Justificación:* Permite consultar y editar razas de forma autónoma en `BreedsPage` sin depender de que HU-20 esté mergeada, e incluye `species: { id, name }` para mostrar el nombre de la especie en la tabla sin llamadas adicionales.

2. **Regla de especie activa al actualizar**
   - *Decisión:* Si el usuario reasigna la raza a una especie diferente (`dto.speciesId !== existing.speciesId`), la especie destino debe estar activa (`409` si está inactiva). Si mantiene la misma especie ya asociada, se permite actualizar nombre/descripción aunque dicha especie haya sido inactivada posteriormente. En `BreedForm`, el selector muestra las especies activas más la especie actual de la raza (si no estuviera ya en la lista) para evitar pérdida de selección.
   - *Justificación:* Respeta la integridad de nuevas asociaciones (solo especies activas) sin bloquear correcciones de texto en razas existentes.

3. **Conservación de pacientes e historias clínicas asociadas**
   - *Decisión:* `UpdateBreedService` actualiza exclusivamente los campos editables (`name`, `speciesId`, `description`) del registro `Breed` por su UUID sin eliminar ni modificar registros de `Patient` ni sus historiales clínicos.
   - *Justificación:* Garantiza que los pacientes vinculados por `breedId` conserven intactas sus historias clínicas.

4. **Auditoría atómica con `previousValue` y `newValue`**
   - *Decisión:* Registrar `AUDIT_ACTIONS.update` (`'Actualizar'`) en `AUDIT_MODULES.breeds` (`'Razas'`) dentro de la transacción de `UpdateBreedService`, solo cuando `name`, `speciesId` o `description` cambien efectivamente, guardando `affectedRecord: "${updated.name} (${species.name})"` y los valores previos/nuevos (`{ name, species, description }`).

## Risks / Trade-offs

- **[Sincronización con PR #35 (HU-14) en `audit.catalog.ts` y `catalogs-page.tsx`]** → Usar exactamente las mismas claves/clases (`AUDIT_ACTIONS.update = 'Actualizar'`, `.catalogs-page`) para que el merge con `development` sea limpio.

## Entorno local y verificación

- **Servicios Docker:** API (`3080`), Frontend (`5174`), PostgreSQL (`55432`).
- **Comandos de verificación:**
  - Backend: `docker compose exec -T api sh -c 'npm test && npm run lint && npx tsc -p tsconfig.build.json --noEmit'`
  - Frontend: `docker compose exec -T frontend sh -c 'npm test && npm run lint && npm run build'`
