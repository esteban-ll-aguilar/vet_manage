## Why

El catálogo de razas del Módulo 1 (Historial Clínico) actualmente solo permite registrar razas nuevas (`HU-17`) y consultar razas activas por especie para el selector de pacientes, pero no permite corregir el nombre, cambiar la especie asociada o editar la descripción de una raza ya registrada. Implementar **HU-18 · Actualizar Raza** (RF-19, `#30`) habilita al Veterinario a mantener actualizado el catálogo de razas sin alterar las historias clínicas de los pacientes asociados.

## What Changes

- **Backend (`vet-manage-api`)**:
  - Asegurar la acción `update: 'Actualizar'` en `AUDIT_ACTIONS` (`audit.catalog.ts`).
  - Agregar `GET /api/v1/pets/breeds` (protegido con `breeds:read`) para listar las razas registradas con su especie asociada ordenadas alfabéticamente.
  - Agregar `PATCH /api/v1/pets/breeds/:id` (protegido con `breeds:update` y `ParseUUIDPipe`) mediante `UpdateBreedService` y `UpdateBreedDto`.
  - Validar existencia de la raza (`404`), nombre obligatorio (`400`), especie asociada obligatoria y existente (`400`/`404`), especie activa al reasignar (`409`), descripción opcional de hasta 500 caracteres (`400` / `null` si vacía), unicidad de nombre dentro de la especie destino excluyendo la propia raza (`409`), conservación íntegra de pacientes e historias clínicas asociadas, y auditoría atómica (`Actualizar`, módulo `Razas`, `previousValue`/`newValue`, sin duplicar registro cuando no hay cambios).
- **Frontend (`vet-manage-frontend`)**:
  - Agregar `listBreeds()` y `updateBreed(id, draft)` en `breed.service.ts`.
  - Extender `BreedForm` con `initialValue` y `submitLabel` opcionales para reutilizar validaciones y flujo de cancelación tanto en creación como en edición.
  - Actualizar `BreedsPage` para listar las razas registradas con tabla enriquecida a ancho completo, mostrar el botón de icono **Editar** con tooltip solo con `breeds:update`, abrir el modal prellenado con los datos actuales, descartar cambios al cancelar y confirmar con toast `"Raza actualizada exitosamente"`.

## Capabilities

### New Capabilities
- `breed-update-ui`: Listado y modal de actualización de razas en `BreedsPage` con control por permiso `breeds:update`, validaciones de nombre y especie, cancelación y confirmación vía toast.

### Modified Capabilities
- `breed-catalog`: Agregar listado general de razas (`GET /api/v1/pets/breeds`) y actualización de razas (`PATCH /api/v1/pets/breeds/:id`) con validaciones de integridad y conservación de pacientes/historias clínicas.
- `audit-log`: Incorporar la acción `"Actualizar"` en el catálogo compartido y auditar la actualización de razas en el módulo `"Razas"`.

## Impact

- **Backend**: `vet-manage-api/src/modules/audit/audit.catalog.ts`, `vet-manage-api/src/modules/pets/` (`dtos/breeds/`, `repositories/breed.repository.ts`, `services/breeds/`, `routes/breed.controller.ts`, `pets.module.ts`).
- **Frontend**: `vet-manage-frontend/src/modules/pets/` (`types.ts`, `services/breed.service.ts`, `components/breed-form.tsx`, `pages/breeds-page.tsx`, `pages/breeds-page.test.tsx`), `vet-manage-frontend/src/modules/catalogs/pages/catalogs-page.tsx` y `vet-manage-frontend/src/styles/index.css`.
- **Base de datos**: Sin migraciones; se reutiliza el modelo `Breed` existente en Prisma.
