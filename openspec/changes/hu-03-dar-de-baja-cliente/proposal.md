## Why

El Gerente o el Veterinario necesita retirar de forma definitiva a un cliente de la gestión de la clínica sin perder su información ni la de sus mascotas (**HU-03 · Dar de baja un cliente**, RF-03, Sprint 2). HU-04 y HU-05 ya resolvieron los estados reversibles (`Activo` ↔ `Inactivo`) con un servicio compartido de cambios de estado; falta el estado final `De baja`, que hoy solo puede existir cargado por semilla y que nadie puede asignar desde el sistema.

Documentación funcional de referencia:
- `docs/modulo-1-historial-clinico/historias-usuario/01-clientes.md` (HU-03, RF-03)
- `docs/modulo-1-historial-clinico/matriz-roles-permisos.md` (sección 2.2: «Dar de baja cliente» solo para Gerente y Veterinario → permiso `clients:deactivate`)
- `docs/modulo-1-historial-clinico/diagramas/estados.md` y `diagramas/clases.md` (estado `DadoDeBaja` de `Cliente`, sin transición de salida)

## What Changes

- Ampliar `ChangeClientStatusService` (`vet-manage-api/src/modules/clients/services/change-client-status.service.ts`) con `deactivate(clientId, reason, actorId)`: transición `ACTIVE | INACTIVE → DEACTIVATED`, motivo obligatorio (1 a 500 caracteres) y rechazo si el cliente no existe o ya está desactivado.
- Guardar en el cliente la fecha, el usuario responsable y el motivo de la baja: columnas nuevas `deactivated_at`, `deactivated_by_id` y `deactivation_reason` en `clients` (**migración aprobada**).
- Exponer `PATCH /api/v1/clients/:clientId/deactivate` con cuerpo `{ reason }`, protegido con `@RequirePermissions('clients:deactivate')`.
- Registrar la baja en la auditoría, en la misma transacción, con la nueva acción del catálogo **"Dar de baja"**, módulo "Clientes", valor anterior `{ status }` y valor nuevo `{ status: "De baja", reason }`.
- Mostrar la información de un cliente de baja (datos, motivo, fecha, responsable y mascotas) en modo solo lectura.
- Bloquear al cliente de baja en nuevas transacciones del Módulo 1 con el mensaje **«El cliente está desactivado»** (decisión del PO).
- Frontend (`ClientsPage`): acción **Dar de baja** solo con `clients:deactivate` y para clientes `Activo` o `Inactivo`; modal con motivo obligatorio y contador, transición `→ De baja` y «Cancelar» sin cambios.
- Pruebas con casos positivos, negativos y de valor límite (motivo de 0, 1, 500 y 501 caracteres).

## Capabilities

### New Capabilities
- `client-deactivation`: Baja definitiva de clientes en la API (`PATCH /api/v1/clients/:clientId/deactivate`): motivo obligatorio, datos de la baja guardados, consulta en solo lectura y bloqueo en nuevas transacciones; protegida con `clients:deactivate`.
- `client-deactivation-ui`: Acción «Dar de baja» con modal de confirmación, motivo obligatorio, cancelación sin cambios, visibilidad según permiso y vista en solo lectura de un cliente de baja.

### Modified Capabilities
- `audit-log`: Agregar la acción del catálogo "Dar de baja" y auditar la baja de un cliente con su estado anterior, el nuevo estado y el motivo.

## Impact

- **Base de datos (`vet-manage-api/prisma`)**: migración `add_client_deactivation` que agrega `deactivated_at`, `deactivated_by_id` (FK a `users`, `onDelete: Restrict`) y `deactivation_reason` a `clients`. No modifica datos existentes.
- **Backend (`vet-manage-api`)**:
  - `src/modules/clients/services/change-client-status.service.ts` y su `.spec.ts`.
  - `src/modules/clients/routes/clients.controller.ts` y su `.spec.ts`; nuevo DTO `dtos/deactivate-client.dto.ts`.
  - `src/modules/audit/audit.catalog.ts` (acción `deactivate: 'Dar de baja'`).
  - `src/modules/clients/repositories/clients.repository.ts` y `dtos/client-response.dto.ts` (datos de la baja).
  - `src/modules/pets/services/patients/register-patient.service.ts` (mensaje «El cliente está desactivado» para clientes `DEACTIVATED`).
- **Frontend (`vet-manage-frontend`)**: `src/modules/clients/types.ts`, `services/clients-api.ts`, `pages/clients-page.tsx`, `clients-page.css` y sus pruebas.
- **Pendiente (fuera de este cambio)**: verificar que el cliente no tenga citas futuras pendientes (HU-03 Esc. 2). Requiere consultar al Módulo 2 (agenda) y espera su aprobación; se agregará como cambio aparte.
- **Fuera de alcance**: facturas y atenciones médicas todavía no existen; no hay reactivación de un cliente de baja (estado final del diagrama de estados).
