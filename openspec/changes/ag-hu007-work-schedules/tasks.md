# Tasks

## Layer 0 — BDD y contrato

- [x] 0.1 Formalizar los escenarios de HU-007 en `specs/work-schedules/spec.md`.
- [x] 0.2 Definir DTOs de creación, actualización, consulta y respuesta.

## Layer 1 — Backend: repositorio y servicios

- [x] 1.1 Crear `WorkScheduleRepository` con operaciones CRUD sobre `HorarioBase`.
- [x] 1.2 Crear `CreateWorkScheduleService` con validaciones de negocio.
- [x] 1.3 Crear `ListWorkSchedulesService` con filtros y listado de veterinarios.
- [x] 1.4 Crear `UpdateWorkScheduleService` con validación de impacto.
- [x] 1.5 Crear `DeleteWorkScheduleService` con validación de impacto.
- [x] 1.6 Registrar providers y controller en `WorkSchedulesModule`.

## Layer 2 — Backend: controller y tests

- [x] 2.1 Crear `WorkSchedulesController` con endpoints protegidos.
- [x] 2.2 Escribir tests unitarios de `CreateWorkScheduleService`.
- [x] 2.3 Escribir tests unitarios de `UpdateWorkScheduleService`.
- [x] 2.4 Escribir tests unitarios de `DeleteWorkScheduleService`.

## Layer 3 — Frontend

- [x] 3.1 Crear tipos y servicio API para work-schedules.
- [x] 3.2 Crear componente de filtros (sucursal + veterinario).
- [x] 3.3 Crear componente de tabla de horarios.
- [x] 3.4 Crear componente de formulario modal de creación/edición.
- [x] 3.5 Integrar componentes en `WorkSchedulesPage` con permisos.

## Layer 4 — Verificación

- [x] 4.1 Ejecutar tests unitarios y de lint backend.
- [x] 4.2 Ejecutar lint y build frontend.
- [x] 4.3 Verificar cada criterio de aceptación contra la implementación.

## Parallelization plan

- Layer 0 precede a todas las capas.
- Layers 1 y 2 son secuenciales (repo → services → controller → tests).
- Layer 3 puede avanzar en paralelo con Layer 2 una vez definido el contrato.
- Layer 4 depende de todas las anteriores.
