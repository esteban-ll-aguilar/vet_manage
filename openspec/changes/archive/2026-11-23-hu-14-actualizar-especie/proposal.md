## Why

En el Módulo 1 (Historial Clínico), el Veterinario necesita actualizar el nombre o la descripción de una especie animal ya registrada en el catálogo para mantener los datos generales al día sin perder su trazabilidad ni afectar los pacientes asociados (**HU-14 · Actualizar especie**, issue `#29`, Sprint 2).

Documentación funcional de referencia:
- `docs/modulo-1-historial-clinico/historias-usuario/03-especies-razas.md` (HU-14, RF-14)
- `docs/modulo-1-historial-clinico/matriz-roles-permisos.md` (sección 2.4: permiso `species:update` para Veterinario)

## What Changes

- Agregar `update: 'Actualizar'` a `AUDIT_ACTIONS` en `vet-manage-api/src/modules/audit/audit.catalog.ts`.
- Crear `UpdateSpeciesDto` (`vet-manage-api/src/modules/pets/dtos/species/update-species.dto.ts`) y `UpdateSpeciesService` (`vet-manage-api/src/modules/pets/services/species/update-species.service.ts`) que:
  - Valida que la especie existe (`404` `"Especie no encontrada"`).
  - Valida que el nombre sea obligatorio (`400` `"El nombre de la especie es obligatorio"`).
  - Valida unicidad del nombre insensible a mayúsculas/minúsculas excluyendo la propia especie (`409`).
  - Permite guardar con descripción vacía/opcional (`description: null`).
  - Actualiza el registro y escribe la auditoría atómica (`Actualizar`, módulo `Especies`, `previousValue` y `newValue`) dentro de la misma transacción Prisma.
- Agregar `update` y `findAll` en `SpeciesRepository`, y exponer `PATCH /api/v1/pets/species/:id` (`@RequirePermissions('species:update')`) y `GET /api/v1/pets/species` (`@RequirePermissions('species:read')`) en `SpeciesController`.
- Reutilizar `SpeciesForm` en modo creación y edición (`initialValue` opcional) y actualizar `SpeciesPage` (`vet-manage-frontend/src/modules/pets/pages/species-page.tsx`) para listar las especies registradas, mostrar el botón de icono **Editar** con tooltip (solo con `species:update`), abrir el modal prellenado con la especie seleccionada, descartar cambios al presionar **Cancelar** y confirmar con toast `"Especie actualizada exitosamente"`.
- Añadir pruebas unitarias de backend (`update-species.service.spec.ts`) y frontend (`species-form.test.tsx`, `species-page.test.tsx`).

## Capabilities

### New Capabilities
- `species-update-ui`: Edición de especies en `SpeciesPage` con listado base, botón **Editar** controlado por `species:update`, formulario prellenado reutilizando `SpeciesForm`, cancelación que descarta cambios y confirmación vía toast.

### Modified Capabilities
- `species-catalog`: Incorporar la actualización de especies (`PATCH /api/v1/pets/species/:id`) con validaciones de nombre obligatorio, unicidad, descripción opcional y permiso `species:update`, además de listado general (`GET /api/v1/pets/species`).
- `audit-log`: Incorporar la acción `"Actualizar"` en el catálogo compartido de auditoría y registrar atómicamente la actualización de una especie con sus valores anterior y nuevo.

## Impact

- **Backend (`vet-manage-api`)**:
  - `src/modules/audit/audit.catalog.ts` (nueva acción `update`).
  - `src/modules/pets/dtos/species/update-species.dto.ts` (nuevo).
  - `src/modules/pets/repositories/species.repository.ts`.
  - `src/modules/pets/services/species/update-species.service.ts` y `update-species.service.spec.ts` (nuevos).
  - `src/modules/pets/routes/species.controller.ts` y `pets.module.ts`.
  - No requiere migración Prisma.
- **Frontend (`vet-manage-frontend`)**:
  - `src/modules/pets/services/species.service.ts`, `components/species-form.tsx`, `components/species-form.test.tsx`.
  - `src/modules/pets/pages/species-page.tsx` y `species-page.test.tsx`.
