## 1. Catálogo de auditoría

- [x] 1.1 Agregar `update: 'Actualizar'` a `AUDIT_ACTIONS` en `vet-manage-api/src/modules/audit/audit.catalog.ts`.

## 2. Backend – Actualización y listado de especies (`pets`)

- [x] 2.1 Crear `vet-manage-api/src/modules/pets/dtos/species/update-species.dto.ts` con `name` y `description` opcional.
- [x] 2.2 Agregar `findAll()` y `update(id, data, tx)` en `vet-manage-api/src/modules/pets/repositories/species.repository.ts`.
- [x] 2.3 Crear `vet-manage-api/src/modules/pets/services/species/update-species.service.ts` validando existencia (`404`), nombre obligatorio (`400`), unicidad excluyendo la propia especie (`409`), descripción opcional (`null`), actualización y auditoría atómica (`Actualizar`, `Especies`, `previousValue`/`newValue`, sin duplicar auditoría si no hubo cambios).
- [x] 2.4 Registrar `UpdateSpeciesService` en `vet-manage-api/src/modules/pets/pets.module.ts` y exponer `GET /pets/species` (`species:read`) y `PATCH /pets/species/:id` (`species:update`, `ParseUUIDPipe`) en `vet-manage-api/src/modules/pets/routes/species.controller.ts`.
- [x] 2.5 Crear pruebas unitarias en `vet-manage-api/src/modules/pets/services/species/update-species.service.spec.ts` cubriendo actualización exitosa, sin descripción, nombre vacío (`400`), nombre duplicado (`409`), especie inexistente (`404`), sin cambios sin auditoría duplicada y metadato de permiso `species:update`.

## 3. Frontend – Edición de especies en `SpeciesPage`

- [x] 3.1 Agregar `listSpecies()` y `updateSpecies(id, draft)` en `vet-manage-frontend/src/modules/pets/services/species.service.ts`.
- [x] 3.2 Extender `vet-manage-frontend/src/modules/pets/components/species-form.tsx` con `initialValue` y `submitLabel` opcionales para soportar edición y creación reutilizando las mismas validaciones.
- [x] 3.3 Actualizar `vet-manage-frontend/src/modules/pets/pages/species-page.tsx` para listar las especies registradas con badges de estado, mostrar el botón de icono **Editar** con tooltip solo con `hasPermission('species:update')`, abrir el modal prellenado, descartar cambios al cancelar y mostrar toast `"Especie actualizada exitosamente"`.
- [x] 3.4 Ampliar pruebas en `vet-manage-frontend/src/modules/pets/pages/species-page.test.tsx` cubriendo listado, visibilidad de **Editar** por permiso, actualización exitosa, actualización sin descripción, validación de nombre obligatorio y cancelación.

## 4. Verificación final

- [x] 4.1 Ejecutar pruebas, lint y compilación de backend y frontend en Docker (`api` y `frontend`).
