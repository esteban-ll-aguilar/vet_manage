
# Proposal: HU-006 Consultar recursos disponibles

## Why

La recepcionista necesita consultar qué veterinarios y consultorios están disponibles en una sucursal, fecha y horario determinados antes de seleccionar los recursos para una cita, evitando conflictos con jornadas, disponibilidades, turnos, citas y bloqueos existentes.

## What changes

- Implementar la consulta de veterinarios y consultorios disponibles en `resources`.
- Permitir consultar por sucursal, fecha, hora y duración.
- Validar una duración mínima de 30 minutos y múltiplos de 30.
- Considerar horarios base, disponibilidad diaria y turnos de sábado.
- Excluir recursos ocupados por citas o afectados por bloqueos durante el intervalo completo.
- Mostrar el mensaje "Sin disponibilidad en el intervalo seleccionado" cuando falte algún tipo de recurso.
- Proteger la consulta con el permiso `resources:read-availability`.
- Integrar la consulta en el frontend reutilizando las convenciones del proyecto.

## In scope

- Backend, frontend y pruebas de CP-006-01 a CP-006-05.
- Consulta de recursos activos de la sucursal seleccionada.
- Validación de fecha, hora y duración.
- Comprobación de disponibilidad durante todo el intervalo solicitado.

## Out of scope

- Crear, confirmar, modificar o cancelar citas.
- Modificar horarios base o disponibilidad diaria.
- Asignar turnos de sábado.
- Crear o eliminar bloqueos de horario.
- Cambiar el esquema Prisma o los permisos de otros roles.

## Success criteria

| CP | Prueba automatizada |
|---|---|
| CP-006-01 | Consultar los recursos que realmente están libres |
| CP-006-02 | Excluir a un veterinario con horario bloqueado |
| CP-006-03 | Consultar cuando falta un recurso |
| CP-006-04 | Consultar una fecha pasada |
| CP-006-05 | Consultar una duración inválida |

## Tables affected

Todas las operaciones son de lectura.

- `users`: veterinarios activos.
- `horarios_base`: jornadas autorizadas.
- `disponibilidades_diarias`: franjas disponibles para la fecha.
- `turnos_sabado`: asignaciones de sábado.
- `salas`: consultorios activos de la sucursal.
- `citas`: ocupación de veterinarios y consultorios.
- `bloqueos_horario`: restricciones de disponibilidad.
- `sucursales`: identificación de la sucursal.

## Endpoints planned

- `GET /api/v1/scheduling/resources/availability`
