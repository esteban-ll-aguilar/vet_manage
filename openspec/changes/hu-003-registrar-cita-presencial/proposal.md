# Registrar una cita presencial

## Why

Recepcionistas necesitan registrar una cita con un paciente, servicio, veterinario y consultorio, conservando la tarifa vigente y evitando reservas duplicadas.

## What changes

- Agrega el registro transaccional de citas presenciales con validaciones de cliente-paciente, fecha, duración, bloqueos y conflictos de recursos.
- Agrega el formulario de agenda con validación de campos obligatorios y confirmación de cita.
- Asigna el permiso de registro al rol Recepcionista.

## Impact

- API NestJS y modelos Prisma existentes de agendamiento.
- Frontend React en el módulo de agenda.
- Catálogo de permisos y rol Recepcionista.
