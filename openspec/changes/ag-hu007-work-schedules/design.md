# Design: HU-007 Definir los horarios base de atención

## Architecture

```text
Frontend (work-schedules/)
  WorkSchedulesPage
    ├── WorkScheduleFilters  → selección de sucursal y veterinario
    ├── WorkScheduleTable    → tabla de horarios (7 columnas: L-S + acciones)
    └── WorkScheduleForm     → dialog modal de creación/edición
      |
      v
  work-schedules-api.ts → httpClient (fetch) → API endpoints
      |
      v
Backend (scheduling/work-schedules/)
  Controller (@Controller('scheduling'))
    ├── GET  work-schedules         → ListWorkSchedulesService
    ├── GET  work-schedules/veterinarians → ListWorkSchedulesService
    ├── POST work-schedules         → CreateWorkScheduleService
    ├── PUT  work-schedules/:id     → UpdateWorkScheduleService
    └── DELETE work-schedules/:id   → DeleteWorkScheduleService
                |
                v
         WorkScheduleRepository → Prisma → PostgreSQL (horarios_base)
```

## Data model

Modelo existente `HorarioBase` en `agendamiento.prisma`:

- `id`: UUID auto-generado.
- `veterinarioId`: FK a `User`.
- `sucursalId`: FK a `Sucursal`.
- `diaSemana`: Enum `DiaSemana` (LUNES–SABADO).
- `horaInicio` / `horaFin`: `@db.Time(0)`, almacenado como `Date(1970-01-01)`.
- `estado`: boolean (`true` = vigente).
- Índices: `[veterinarioId, diaSemana, estado]`, `[sucursalId, diaSemana]`.

No se modifica el schema; se usa tal cual.

## API contract

### `POST /scheduling/work-schedules`

```json
{
  "veterinarioId": "uuid",
  "sucursalId": "uuid",
  "diaSemana": "LUNES",
  "horaInicio": "08:00",
  "horaFin": "12:00"
}
```

Respuesta exitosa: `success(horario, 'Horario registrado correctamente')`.

Validaciones backend:
1. `horaInicio` y `horaFin` deben ser en punto o media hora.
2. `horaFin` > `horaInicio`.
3. No debe existir un horario activo del mismo veterinario en el mismo día
   que se cruce (en cualquier sucursal).
4. Para actualización: el nuevo rango no debe dejar fuera citas confirmadas
   ni disponibilidad diaria existente.

### `PUT /scheduling/work-schedules/:id`

Mismo body que POST. Aplica las mismas validaciones más la verificación de
impacto en citas y disponibilidad.

### `GET /scheduling/work-schedules?veterinarioId=...&sucursalId=...`

Retorna horarios activos filtrados. Incluye datos del veterinario y sucursal.

### `GET /scheduling/work-schedules/veterinarians`

Retorna usuarios con rol `veterinario` activos. Reutiliza el patrón del
repositorio de identidad.

### `DELETE /scheduling/work-schedules/:id`

Soft-delete: cambia `estado` a `false`. Solo si no hay citas futuras
confirmadas en ese horario.

## Frontend UX

- Pantalla con filtros superiores (sucursal y veterinario como selectores).
- Tabla que muestra los horarios del veterinario seleccionado por día.
- Botón "Nuevo horario" visible solo con permiso `work-schedules:manage`.
- Formulario en modal con selectores de sucursal, veterinario, día,
  hora inicio y hora fin (selectores en pasos de 30 min).
- Mensajes de error y éxito con `react-hot-toast`.
- Estados de carga, vacío y error.
- Botones de editar y eliminar visibles solo con permiso `work-schedules:manage`.

## Shared utilities

Se reutilizan de `scheduling/common/time-slots.ts`:
- `parseTime()` / `formatTime()` para conversión HH:mm ↔ minutos.
- `isOnSlot()` para validar horas en punto o media hora.
- `minutesToDbTime()` / `dbTimeToMinutes()` para conversión Prisma.
- `overlaps()` para detectar cruces de intervalos.

## Decisions

- El endpoint de veterinarios se coloca en work-schedules porque es un dato
  auxiliar para el formulario de esta sección. Si otro módulo lo necesita,
  se puede mover a un módulo compartido.
- Se usa soft-delete (`estado = false`) en vez de eliminar el registro para
  preservar historial y relaciones.
- La validación de impacto en citas consulta citas con estado `CONFIRMADA`
  o `PROGRAMADA` que caigan en un día de la semana coincidente y cuya hora
  esté fuera del nuevo rango.
- El frontend no implementa paginación porque el volumen de horarios por
  veterinario es inherentemente bajo (máximo 6 días × N sucursales).
