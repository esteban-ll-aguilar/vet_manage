## Context

El módulo `pets` (catálogo de especies) en `vet-manage-api` ya cuenta con:
- Modelo `Species` (`id`, `name`, `description`, `isActive`, `createdAt`, `updatedAt`).
- Permisos en `clinical.permissions.ts`: `species:create`, `species:read`, `species:update`, `species:change-status` (el rol `veterinarian` ya tiene `species:update` en `roles.catalog.ts`).
- `SpeciesRepository` (`findByName`, `findById`, `create`, `findActive`), `RegisterSpeciesService` y `SpeciesController` (`POST /pets/species`, `GET /pets/species/active`).
- En `vet-manage-frontend`, `SpeciesPage` (`src/modules/pets/pages/species-page.tsx`) ya tiene modal de creación reutilizando `SpeciesForm` (`src/modules/pets/components/species-form.tsx`) y `useToast()`.

## Goals / Non-Goals

**Goals:**
- Agregar `update: 'Actualizar'` a `AUDIT_ACTIONS` en `src/modules/audit/audit.catalog.ts`.
- Exponer `PATCH /api/v1/pets/species/:id` protegido con `@RequirePermissions('species:update')` y `GET /api/v1/pets/species` protegido con `@RequirePermissions('species:read')`.
- Implementar `UpdateSpeciesService` con validaciones de existencia (`404`), nombre obligatorio (`400`), unicidad excluyendo la propia especie (`409`), descripción opcional (`null` si vacía) y registro atómico en auditoría (`Actualizar`, módulo `Especies`, `previousValue` / `newValue`).
- Actualizar `SpeciesPage` y `SpeciesForm` para mostrar el listado de especies registradas, editar con botón de icono + tooltip (solo con `species:update`), descartar cambios al cancelar y confirmar con toast.

**Non-Goals:**
- Activar e inactivar especies (`species:change-status`): corresponde a **HU-15**.
- Búsqueda avanzada / detalle de especies: corresponde a **HU-16** (podrá ampliar `GET /pets/species` y `SpeciesPage` sin conflictos).
- Migraciones de base de datos: no se requieren cambios en `prisma/schema/`.

## Decisions

1. **Endpoint `PATCH /api/v1/pets/species/:id` + listado base `GET /api/v1/pets/species`**
   - *Decisión:* Exponer `PATCH /pets/species/:id` (`ParseUUIDPipe`, `@RequirePermissions('species:update')`) y `GET /pets/species` (`@RequirePermissions('species:read')`) devolviendo `{ id, name, description, isActive, createdAt, updatedAt }[]` ordenados por nombre.
   - *Justificación:* Permite consultar y editar especies de forma autónoma en `SpeciesPage` sin depender de que HU-16 ya esté mergeada.

2. **Reutilización de `SpeciesForm` en modo creación y edición**
   - *Decisión:* Extender `SpeciesForm` con `initialValue?: { name: string; description?: string | null }` y `submitLabel?: string`, inicializando el estado con `initialValue` y descartando cambios al presionar `"Cancelar"`.
   - *Justificación:* Mantiene una sola fuente de verdad para validaciones de especie (`validateSpeciesDraft`) y evita duplicar formularios.

3. **Auditoría atómica con `previousValue` y `newValue`**
   - *Decisión:* Registrar `AUDIT_ACTIONS.update` (`'Actualizar'`) en `AUDIT_MODULES.species` (`'Especies'`) dentro de la transacción de `UpdateSpeciesService`, solo si `name` o `description` cambiaron efectivamente, guardando `{ name, description }` anterior y nuevo.

## Risks / Trade-offs

- **[Integración paralela con HU-15 y HU-16 en `SpeciesPage`]** → Mantener `SpeciesPage` limpia con tabla estándar, badges diferenciados y columna de acciones por permiso para que HU-15 (activar/inactivar) y HU-16 (buscador) se integren fácilmente.

## Entorno local y verificación

- **Servicios Docker:** API (`3080`), Frontend (`5174`), PostgreSQL (`55432`).
- **Comandos de verificación:**
  - Backend: `docker compose exec -T api sh -c 'npm test && npm run lint && npx tsc -p tsconfig.build.json --noEmit'`
  - Frontend: `docker compose exec -T frontend sh -c 'npm test && npm run lint && npm run build'`
