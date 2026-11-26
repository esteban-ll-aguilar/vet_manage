
# Design: HU-006 Consultar recursos disponibles

## Architecture

El frontend utilizará el cliente HTTP común `schedulingApi` y los controles de permisos existentes.

El backend reutilizará el submódulo `scheduling/resources/`, siguiendo la arquitectura del proyecto:

- `routes/`: controlador HTTP para consultar disponibilidad.
- `dtos/`: validación de sucursal, fecha, hora y duración.
- `services/`: reglas de negocio para determinar los recursos disponibles.
- `repositories/`: consultas Prisma de solo lectura.

El módulo utilizará el permiso existente `resources:read-availability`.

## Data model

Se reutilizan los modelos Prisma existentes:

- `User`: veterinarios activos con rol `veterinarian`.
- `HorarioBase`: jornadas vigentes por veterinario, sucursal y día.
- `DisponibilidadDiaria`: franjas habilitadas para una fecha.
- `TurnoSabado`: veterinario asignado a una sucursal en sábado.
- `Sala`: consultorios activos de la sucursal.
- `Cita`: ocupación de veterinarios y consultorios.
- `BloqueoHorario`: restricciones por veterinario o sucursal.

No se crean tablas nuevas ni se modifica el esquema Prisma.

## Validation rules

- La sucursal, fecha, hora y duración son obligatorias.
- La fecha debe ser válida y no puede ser pasada.
- La hora debe tener formato `HH:mm` y representar una hora válida.
- La duración mínima es de 30 minutos y debe ser múltiplo de 30.
- El veterinario debe estar activo y tener una jornada vigente en la sucursal.
- La jornada debe cubrir completamente el intervalo solicitado.
- Si existen franjas de disponibilidad diaria, el intervalo debe estar cubierto por una franja habilitada.
- Si no existen franjas diarias, se utiliza la jornada base.
- Los sábados se respeta la asignación de `TurnoSabado`.
- Solo se consideran consultorios activos de la sucursal seleccionada.
- Se excluyen los recursos ocupados por citas que se superpongan con el intervalo.
- Se aplican los bloqueos activos de veterinario y sucursal.
- Si falta al menos un tipo de recurso, se devuelve el mensaje `Sin disponibilidad en el intervalo seleccionado`.

## Concurrency

La consulta de disponibilidad es de solo lectura y no reserva recursos.

La disponibilidad debe comprobarse nuevamente al guardar una cita. Esa validación pertenece a la funcionalidad de agendamiento correspondiente y queda fuera del alcance de HU-006.

## Pending Product Owner

- Confirmar qué estados de cita deben bloquear recursos. HU-019 considera `PROGRAMADA` y `CONFIRMADA`, mientras que HU-014 utiliza todas las citas excepto `CANCELADA`.
- Confirmar el contrato exacto de respuesta cuando no existe disponibilidad.
