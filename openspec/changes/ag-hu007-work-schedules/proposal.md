# Proposal: HU-007 Definir los horarios base de atención

## Why

El administrador o gerente necesita definir por sucursal los días y franjas
horarias de atención de cada veterinario para establecer los límites dentro de
los cuales se ofrecen turnos. Sin estos horarios base el sistema no puede
generar la oferta de turnos ni validar la disponibilidad diaria de los
veterinarios.

## What changes

- Implementar CRUD completo de `HorarioBase` en el submódulo
  `scheduling/work-schedules/`.
- Validar que las horas sean en punto o media hora (`:00` o `:30`).
- Validar que `horaFin` sea posterior a `horaInicio`.
- Detectar cruces de horarios del mismo veterinario entre cualquier sucursal
  para el mismo día de la semana.
- Impedir la reducción de un horario cuando existan citas confirmadas o
  disponibilidad diaria registrada dentro del rango que se eliminaría.
- Proteger los endpoints con `work-schedules:read` y `work-schedules:manage`.
- Reemplazar el placeholder del frontend con la pantalla funcional: tabla de
  horarios filtrable, formulario de creación/edición y controles de permisos.
- Cubrir las reglas de negocio con pruebas unitarias.

## In scope

- CRUD de horarios base de atención (`HorarioBase`).
- Validaciones de reglas de negocio (horas, cruces, impacto en citas).
- Control de permisos backend y frontend.
- Endpoint auxiliar para listar veterinarios disponibles.
- Pruebas unitarias del servicio de creación y actualización.
- Pantalla frontend con tabla, formulario y filtros.

## Out of scope

- Modificaciones al schema Prisma (`agendamiento.prisma` ya tiene el modelo).
- Modificaciones a archivos compartidos (`scheduling.module.ts`, permisos,
  roles, rutas del frontend, navegación).
- Gestión de turnos de sábado (HU-024).
- Disponibilidad diaria (HU-019).
- Oferta de turnos (HU-006).

## Success criteria

- Todos los escenarios BDD de `specs/work-schedules/spec.md` pasan.
- Un horario válido se persiste y aparece en la tabla.
- Hora de fin anterior a hora de inicio es rechazada con mensaje descriptivo.
- Horarios cruzados entre sucursales son rechazados.
- La reducción de un horario que afecta citas o disponibilidad es rechazada.
- Una recepcionista no puede crear ni modificar horarios (403).
- Build, lint y suites de prueba pasan.

## Tables affected

- `horarios_base` (lectura y escritura).
- `disponibilidades_diarias` (lectura para validación de impacto).
- `citas` (lectura para validación de impacto).
- `sucursales` (lectura para listado).
- `users` (lectura para listar veterinarios).

## Endpoints

- `GET    /api/v1/scheduling/work-schedules` — listar horarios (filtros opcionales).
- `GET    /api/v1/scheduling/work-schedules/veterinarians` — listar veterinarios.
- `POST   /api/v1/scheduling/work-schedules` — crear horario.
- `PUT    /api/v1/scheduling/work-schedules/:id` — actualizar horario.
- `DELETE /api/v1/scheduling/work-schedules/:id` — eliminar horario.
