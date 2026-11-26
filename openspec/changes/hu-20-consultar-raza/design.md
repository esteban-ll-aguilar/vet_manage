## Context

- `BreedController` (`src/modules/pets/routes/breed.controller.ts`) expone `GET /pets/breeds` (todas las razas, sin filtros, vía `BreedRepository.findAll`), `GET /pets/species/:speciesId/breeds` (activas, para el selector del paciente), `POST /pets/breeds` (HU-17) y `PATCH /pets/breeds/:id` (HU-18).
- `BreedRepository.findByIdWithSpecies(id)` ya existe.
- La búsqueda sin tildes ya está resuelta para clientes y pacientes: `normalizeSearch` y `patientSearchVariants` (`src/modules/pets/services/patients/`), que reutilizan `ACCENT_EQUIVALENTS` de HU-06.
- `GET /pets/species` (todas las especies, `species:read`) existe; los cuatro roles de HU-20 tienen `species:read` y `breeds:read`.
- `BreedsPage` (`vet-manage-frontend/src/modules/pets/pages/breeds-page.tsx`) ya lista las razas en una tabla y tiene la edición de HU-18.
- Auditoría (HT-04): la spec `audit-log` establece que las lecturas no se auditan.

## Goals / Non-Goals

**Goals:**
- Buscar por nombre y filtrar por especie en la API y en `BreedsPage`, con mensaje de sin resultados.
- Detalle de una raza en solo lectura.
- Mantener compatible el listado actual (sin filtros devuelve lo mismo que hoy).

**Non-Goals:**
- Paginación: el catálogo de razas es pequeño; se reconsidera si supera unos cientos de registros.
- Activar e inactivar razas (HU-19).
- Cambiar permisos: el Administrador ya no tiene permisos de razas en development (matriz 2.4); este cambio solo lo fija con pruebas.

## Decisions

1. **Ampliar `GET /pets/breeds` con query params en lugar de un endpoint nuevo**
   - *Decisión:* `ListBreedsQueryDto { search?: string (≤100), speciesId?: UUID }` y un `FindBreedsService.execute(query)`.
   - *Alternativa:* `GET /pets/breeds/search`. Se descarta porque duplicaría el listado y la UI tendría dos fuentes de datos.

2. **Búsqueda sin tildes reutilizando las variantes de HU-06/HU-12**
   - *Decisión:* generalizar `patientSearchVariants` en un helper del módulo `pets` (`services/search-variants.ts`) y construir un `OR` de `name contains <variante> (insensitive)`. No requiere la extensión `unaccent` ni migración.
   - *Alternativa:* extensión `unaccent` de PostgreSQL. Se descarta para no cambiar el esquema y mantener un solo criterio «sin tildes» en todo el sistema.

3. **Detalle en `GET /pets/breeds/:id`**
   - *Decisión:* `ParseUUIDPipe` (400) y `404 "Raza no encontrada"`; respuesta con la especie asociada.
   - El orden de rutas en el controlador se cuida para que `breeds/:id` no capture `species/:speciesId/breeds`.

4. **Sin auditoría**
   - *Decisión:* no se llama a `AuditService` en ninguna consulta; las pruebas verifican que no se escribe en `audit_logs`.
   - *Justificación:* requisito vigente «Read operations are not audited» de `audit-log`; HU-60 audita escrituras.

5. **Frontend**
   - Barra de herramientas sobre la tabla: búsqueda con espera de 300 ms y filtro de especies (de `GET /pets/species`, incluye inactivas, marcadas como «(inactiva)»).
   - Los filtros se envían a la API (no se filtra en memoria) para que la UI y la API usen el mismo criterio de tildes.
   - Clic en una fila abre un panel lateral de solo lectura; el botón de edición de HU-18 se mantiene según `breeds:update`.

## Risks / Trade-offs

- [Muchas variantes de búsqueda con términos largos] → `MAX_SEARCH_VARIANTS` ya limita las combinaciones; el término se limita a 100 caracteres.
- [Cambio en un helper compartido con pacientes] → Mover el helper sin cambiar su comportamiento y mantener sus pruebas actuales.

## Migration Plan

Sin migraciones. Verificación con `make up` (API `3080`, frontend `5174`).

## Open Questions

Ninguna. El PO confirmó que el Administrador no debe tener acceso a las razas (matriz de roles, sección 2.4).
