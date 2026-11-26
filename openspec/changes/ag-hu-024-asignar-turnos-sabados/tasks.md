# Tasks

## Layer 0 — OpenSpec y contrato

- [x] 0.1 Crear proposal, design y spec de HU-024.
- [x] 0.2 Definir DTOs y respuestas de generación/sustitución.

## Layer 1 — Backend

- [x] 1.1 Crear DTO y repositorio de turnos de sábado.
- [x] 1.2 Crear servicio de generación con rotación.
- [x] 1.3 Crear servicio de sustitución y validaciones.
- [x] 1.4 Crear controller protegido con permisos.
- [x] 1.5 Registrar providers en `SaturdayShiftsModule`.

## Layer 2 — Pruebas

- [x] 2.1 CP-024-01 a CP-024-07 con nombres explícitos.
- [x] 2.2 Metadatos de permisos y guardas existentes cubren 401/403.
- [x] 2.3 Prueba de concurrencia de asignación simultánea.

## Layer 3 — Frontend

- [x] 3.1 Agregar tipos y métodos a `scheduling-api.ts`.
- [x] 3.2 Implementar página de turnos y sustitución.
- [x] 3.3 Mantener ruta, navegación y botones protegidos.

## Layer 4 — Verificación

- [ ] 4.1 Ejecutar pruebas enfocadas.
- [ ] 4.2 Ejecutar suites completas, lint y builds.

## Pending

- Cambio pendiente de decisión del grupo: se retiró
  `saturday-shifts:read` del rol Veterinario en `roles.catalog.ts`, pero este
  cambio no contó con aprobación explícita previa. Debe confirmarse o revertirse
  antes del push.

- Discrepancia de contrato 403: la HU-024 exige
  `"No tiene permisos para esta acción"`, pero el `PermissionsGuard` actual
  devuelve `"No tiene permisos para realizar esta acción"`. Resolverlo requiere
  un cambio aprobado en el módulo compartido Identity y no forma parte de esta HU.
