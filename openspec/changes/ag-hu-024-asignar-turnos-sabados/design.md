# Design: HU-024 Asignar turnos de sábado

## Architecture

`SaturdayShiftsPage` usa `schedulingApi`, el cliente HTTP común y controles con `hasPermission`. El backend conserva el submódulo `scheduling/saturday-shifts/` con controller, DTOs, servicios y repositorio sobre Prisma.

## Data model

Se reutiliza `TurnoSabado` existente:

- `horarioBaseId`, `sucursalId`, `fecha`, `justificacion`.
- Restricción única existente `[sucursalId, fecha]`.
- No se crea un modelo paralelo ni se modifica el esquema en esta HU.

## Validation rules

- Las fechas deben ser sábados.
- Debe existir una jornada base activa `SABADO` que cubra todo el intervalo solicitado.
- La rotación usa una lista ordenada V1, V2 para Loja y avanza por fecha.
- Toda sustitución requiere justificación.
- Un veterinario no puede cubrir dos sucursales con intervalos cruzados.
- Si quitar al veterinario actual afecta una cita programada o confirmada, se conserva la asignación y se retornan los datos de la cita.

## Concurrency

La restricción única existente protege dos altas simultáneas de la misma sucursal y fecha. El repositorio traducirá un conflicto único a la respuesta de validación correspondiente.

## Pending Product Owner

El texto exacto de CP-024-07 es provisional:

`El cambio afecta una cita existente`
