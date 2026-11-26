## 1. Catálogo de Auditoría

- [x] 1.1 Agregar `update: 'Actualizar'` a `AUDIT_ACTIONS` en `vet-manage-api/src/modules/audit/audit.catalog.ts`.

## 2. Backend (`vet-manage-api`)

- [x] 2.1 Crear `vet-manage-api/src/modules/pets/dtos/breeds/update-breed.dto.ts` con `name`, `speciesId` (UUID obligatorio) y `description` opcional (máx. 500 caracteres).
- [x] 2.2 Agregar `findAll()` (con `species: { select: { id: true, name: true } }` ordenado alfabéticamente) y `update(id, data, tx)` en `vet-manage-api/src/modules/pets/repositories/breed.repository.ts`.
- [x] 2.3 Crear `vet-manage-api/src/modules/pets/services/breeds/update-breed.service.ts` validando existencia de raza (`404`), nombre obligatorio (`400`), especie obligatoria/existente (`400`/`404`), especie activa al reasignar (`409`), unicidad en la especie destino excluyendo la propia raza (`409`), descripción opcional (`null`), conservación de pacientes/historias clínicas asociadas y auditoría atómica (`Actualizar`, `Razas`, `previousValue`/`newValue`, sin duplicar auditoría cuando no hay cambios).
- [x] 2.4 Registrar `UpdateBreedService` en `vet-manage-api/src/modules/pets/pets.module.ts` y exponer `GET /pets/breeds` (`breeds:read`) y `PATCH /pets/breeds/:id` (`breeds:update`, `ParseUUIDPipe`) en `vet-manage-api/src/modules/pets/routes/breed.controller.ts`.
- [x] 2.5 Crear pruebas unitarias en `vet-manage-api/src/modules/pets/services/breeds/update-breed.service.spec.ts` cubriendo actualización exitosa, sin descripción, nombre vacío (`400`), especie inexistente (`404`), especie inactiva al reasignar (`409`), nombre duplicado en la misma especie (`409`), raza inexistente (`404`), sin cambios sin auditoría duplicada y metadato de permiso `breeds:update`.

## 3. Frontend (`vet-manage-frontend`)

- [x] 3.1 Actualizar tipos (`Breed` con `species?: SpeciesOption`) y agregar `listBreeds()` y `updateBreed(id, draft)` en `vet-manage-frontend/src/modules/pets/services/breed.service.ts`.
- [x] 3.2 Extender `vet-manage-frontend/src/modules/pets/components/breed-form.tsx` con `initialValue` y `submitLabel` opcionales para soportar edición y creación reutilizando las mismas validaciones.
- [x] 3.3 Actualizar `vet-manage-frontend/src/modules/pets/pages/breeds-page.tsx` (y estilos en `catalogs-page.tsx` / `index.css` a ancho completo `1480px`) para listar las razas registradas con tabla enriquecida (cabecera, íconos, especie asociada, fecha actualizada, badges de estado), mostrar botón de icono **Editar** con tooltip solo con `hasPermission('breeds:update')`, abrir el modal prellenado, descartar cambios al cancelar y mostrar toast `"Raza actualizada exitosamente"`.
- [x] 3.4 Ampliar pruebas en `vet-manage-frontend/src/modules/pets/pages/breeds-page.test.tsx` cubriendo listado, visibilidad de **Editar** por permiso, actualización exitosa, actualización sin descripción, validación de nombre/especie obligatorios y cancelación.

## 4. Verificación

- [x] 4.1 Ejecutar pruebas, lint y compilación de backend y frontend en Docker (`api` y `frontend`).
