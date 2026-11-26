## Context

El módulo `clients` en `vet-manage-api` ya cuenta con:
- Modelo `Client` en `prisma/schema/identity.prisma` con `status: RecordStatus` (`ACTIVE`, `INACTIVE`, `DEACTIVATED`), `personId` único y relación `patients`.
- Permisos separados en `src/config/permissions/clinical.permissions.ts`:
  - `clients:inactivate` (asignado a `manager`, `veterinarian`, `receptionist` en `roles.catalog.ts`).
  - `clients:activate` (HU-05) y `clients:deactivate` (HU-03).
- `ClientsService.findById(id)` ya expone `{ id, status }` para validación entre dominios; `RegisterPatientService` ya rechaza clientes con `status !== 'ACTIVE'` devolviendo `409` (`"El cliente seleccionado no está disponible"`).
- `AuditService.record(tx, entry)` y `AUDIT_ACTIONS.inactivate` (`'Inactivar'`) + `AUDIT_MODULES.clients` (`'Clientes'`) ya existen en `src/modules/audit/`.
- En `vet-manage-frontend`, `ClientsPage` (`src/modules/clients/pages/clients-page.tsx`) lista los clientes con búsqueda, filtro de estado, paginación y expansión de mascotas vinculadas.

## Goals / Non-Goals

**Goals:**
- Exponer `PATCH /api/v1/clients/:clientId/inactivate` protegido con `JwtAuthGuard` y `@RequirePermissions('clients:inactivate')`.
- Implementar `ChangeClientStatusService` (`src/modules/clients/services/change-client-status.service.ts`) dejando la estructura lista para que HU-05 (`activate`) y HU-03 (`deactivate`) se agreguen en el mismo servicio sin conflictos.
- Registrar atómicamente en `audit_logs` la acción `"Inactivar"` en el módulo `"Clientes"` con `previousValue: { status: 'Activo' }` y `newValue: { status: 'Inactivo' }`.
- Incorporar en `ClientsPage` la columna de acciones con botón de icono **Inactivar** (con tooltip, visible solo con `clients:inactivate` y en filas `ACTIVE`), modal de confirmación elegante (consistente con `UsersPage`) y badges de estado diferenciados (`Activo` verde, `Inactivo` rojo coral, `De baja` gris pizarra).
- Preservar intacta la consulta de datos y mascotas vinculadas de clientes inactivos.

**Non-Goals:**
- Activar un cliente (`clients:activate`): corresponde a **HU-05** (Darwin Sarango).
- Dar de baja definitiva a un cliente (`clients:deactivate`): corresponde a **HU-03** (Christian Robles).
- Actualizar datos del cliente: corresponde a **HU-02**.
- Migraciones de base de datos: no se requieren cambios en `prisma/schema/`.

## Decisions

1. **Endpoint dedicado `PATCH /api/v1/clients/:clientId/inactivate` vs endpoint genérico `/status`**
   - *Decisión:* Usar `PATCH /api/v1/clients/:clientId/inactivate` protegido con `@RequirePermissions('clients:inactivate')`.
   - *Justificación:* A diferencia de `users` (donde un solo permiso `users:change-status` cubre activar e inactivar), en `clients` los permisos están separados (`clients:inactivate`, `clients:activate`, `clients:deactivate`) porque Recepcionista puede inactivar/activar pero no dar de baja. Un endpoint dedicado por acción permite aplicar `@RequirePermissions('clients:inactivate')` directamente en el decorador sin lógica de permisos manual en el servicio, y evita conflictos con HU-05 (`/activate`) y HU-03 (`/deactivate`).
   - *Alternativa considerada:* `PATCH /clients/:clientId/status` con body `{ status }`. Se descartó porque obligaría a validar permisos distintos según el body dentro del servicio.

2. **Servicio compartido `ChangeClientStatusService`**
   - *Decisión:* Crear `vet-manage-api/src/modules/clients/services/change-client-status.service.ts` siguiendo `estructura-carpetas.md`, con el método `inactivate(clientId: string, actorId: string)`.
   - *Justificación:* Mantiene la convención de un servicio de transición de estado por dominio, con mensajes exportados (`CLIENT_STATUS_MESSAGES`), transacción Prisma y auditoría atómica.

3. **Comportamiento frente a estados actuales**
   - `ACTIVE` → actualiza a `INACTIVE`, registra auditoría atómica (`Inactivar`, `Clientes`, `describePerson(client.person)`, `previousValue: { status: 'Activo' }`, `newValue: { status: 'Inactivo' }`) y responde `200` con `"Cliente inactivado correctamente"`.
   - `INACTIVE` → retorna `200` de forma idempotente sin duplicar registro de auditoría.
   - `DEACTIVATED` → rechaza con `400` (`CLIENT_STATUS_DEACTIVATED`, `"No se puede inactivar un cliente dado de baja"`).
   - No encontrado → rechaza con `404` (`"Cliente no encontrado"`).

4. **Restricción en nuevas transacciones (Escenario 2)**
   - *Decisión:* Mantener la regla de arquitectura de `estructura-carpetas.md`: otros módulos validan el estado del cliente a través de `ClientsService.findById(id)` (como ya hace `RegisterPatientService` devolviendo `409` cuando `client.status !== 'ACTIVE'`), y pueden consultar solo clientes activos con `GET /api/v1/clients?status=ACTIVE`.

5. **Interfaz en `ClientsPage`**
   - *Decisión:* Agregar la columna `Acciones` cuando `hasPermission('clients:inactivate')` (actualizando `colSpan` de la fila expandible de mascotas). Mostrar el botón de icono **Inactivar** solo en filas con estado `ACTIVE` y abrir un modal de confirmación con resumen del cliente, transición `Activo → Inactivo`, descripción clara y botones `"Cancelar"` / `"Confirmar"`, siguiendo el mismo lenguaje visual de `UsersPage`.

## Risks / Trade-offs

- **[Clientes inactivos aún visibles en la consulta general]** → Es el comportamiento requerido por el Escenario 3 (conservar y permitir consultar su ficha y mascotas); los flujos de nuevas transacciones filtran por `status=ACTIVE` y validan `client.status === 'ACTIVE'` en backend.
- **[Evolución paralela con HU-05 y HU-03 en Sprint 2]** → Separar el endpoint (`/inactivate`) y mantener `ChangeClientStatusService` modular minimiza posibles conflictos al integrar HU-05 (`/activate`) y HU-03 (`/deactivate`).

## Entorno local y verificación

- **Servicios Docker:** PostgreSQL (`55432`), Redis (`56379`), RabbitMQ (`5672` / UI `15673`), API (`3080`), Frontend (`5174`).
- **Variables de entorno:** `.env` (copiado desde `.env.example`).
- **Comandos de verificación:**
  - Arranque local: `make up`
  - Pruebas backend: `docker compose exec -T api sh -c 'npm test && npm run lint && npm run build'`
  - Pruebas frontend: `docker compose exec -T frontend sh -c 'npm test && npm run lint && npm run build'`
