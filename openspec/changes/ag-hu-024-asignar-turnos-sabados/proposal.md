# Proposal: HU-024 Asignar los turnos de los sábados

## Why

Administradores y gerentes necesitan asignar exactamente un veterinario por sucursal y sábado dentro de una jornada autorizada, con una rotación revisable y sustituciones justificadas.

## What changes

- Implementar generación y guardado de rotaciones en `saturday-shifts`.
- Permitir sustitución manual de un veterinario de turno con justificación.
- Validar jornada autorizada, unicidad, cruces horarios y citas existentes.
- Proteger lectura y gestión con permisos de scheduling.
- Agregar la pantalla frontend y reutilizar el cliente HTTP común.

## In scope

- Backend, frontend y pruebas de los CP-024-01 a CP-024-07.
- Pruebas de 401/403 y concurrencia.
- Restricción única por sucursal y fecha ya existente en Prisma.

## Out of scope

- Cambios en horarios base, citas, sucursales o migraciones ajenas.
- Movimiento o cancelación automática de citas.
- Cambio de permisos para roles distintos de Administrador y Gerente.

## Success criteria

| CP | Prueba automatizada |
|---|---|
| CP-024-01 | Unit/E2E: rotación V1, V2, V1 y un único veterinario por sábado |
| CP-024-02 | Unit/E2E: sustitución por V3 con justificación |
| CP-024-03 | Unit/E2E: sustitución por V1 que ya tuvo el turno anterior |
| CP-024-04 | Unit/E2E: ausencia de horario base el 28/11/2026 |
| CP-024-05 | Unit/E2E: rechazo de dos veterinarios en una sucursal y fecha |
| CP-024-06 | Unit/E2E: rechazo por intervalos cruzados entre sucursales |
| CP-024-07 | Unit/E2E: bloqueo de sustitución por cita confirmada |

## Tables affected

- `turnos_sabado`: lectura y escritura.
- `horarios_base`: lectura.
- `sucursales`: lectura.
- `users`: lectura de veterinarios elegibles.
- `citas`: lectura para validar impacto.

## Endpoints planned

- `GET /api/v1/scheduling/saturday-shifts`
- `POST /api/v1/scheduling/saturday-shifts/generate`
- `PUT /api/v1/scheduling/saturday-shifts/:id`
