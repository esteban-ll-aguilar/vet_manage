## Context

- `Client` (`prisma/schema/identity.prisma`) solo guarda `status` (`RecordStatus`: `ACTIVE`, `INACTIVE`, `DEACTIVATED`); no tiene dónde registrar la fecha, el responsable ni el motivo de una baja. `User` ya resolvió lo mismo con `deactivatedAt` y `deactivationReason`.
- `ChangeClientStatusService` (HU-04/HU-05) centraliza las transiciones reversibles `ACTIVE ↔ INACTIVE` con transacción Prisma y `AuditService.record`. Ya rechaza clientes `DEACTIVATED` con `400`.
- `UpdateClientService` (HU-02) ya rechaza editar un cliente `DEACTIVATED` (`409`), y `RegisterPatientService` (HU-07) rechaza clientes que no estén `ACTIVE` con «El cliente seleccionado no está disponible».
- El permiso `clients:deactivate` existe y solo lo tienen Gerente y Veterinario, igual que la matriz de roles (sección 2.2).
- Auditoría (HT-04): `AuditLog` con `previousValue` / `newValue` en JSON, escritura en la misma transacción y catálogo compartido en `src/modules/audit/audit.catalog.ts`.

## Goals / Non-Goals

**Goals:**
- `PATCH /api/v1/clients/:clientId/deactivate` con motivo obligatorio y auditoría atómica.
- Guardar fecha, responsable y motivo de la baja en el propio cliente y mostrarlos en su ficha en solo lectura.
- Acción «Dar de baja» en `ClientsPage` con confirmación, cancelación y visibilidad por permiso.
- Pruebas que cubran casos positivos, negativos y de valor límite.

**Non-Goals:**
- **Citas futuras pendientes (Esc. 2):** queda en espera hasta que se apruebe consultar al Módulo 2 (agenda). Se implementará como un cambio aparte, sin modificar este contrato de API (se agregará una respuesta `409` nueva).
- Reactivar un cliente de baja: el diagrama de estados define `DadoDeBaja` como estado final.
- Facturas y atenciones médicas: todavía no existen. Cuando se implementen, sus servicios deben rechazar clientes `DEACTIVATED` usando `ClientsService.findById`.

## Decisions

1. **Datos de la baja en `Client` (aprobado)**
   - *Decisión:* migración `add_client_deactivation` que agrega `deactivatedAt DateTime?`, `deactivatedById String? @db.Uuid` (relación a `User`, `onDelete: Restrict`) y `deactivationReason String? @db.VarChar(500)`.
   - *Alternativa descartada:* leerlos de `audit_logs`; la ficha del cliente tendría que consultar la auditoría, que es de solo lectura y para el Administrador.

2. **Reutilizar `ChangeClientStatusService` con un método `deactivate`**
   - *Decisión:* agregar `deactivate(clientId, reason, actorId)` al servicio existente (diseñado en HU-04 como el servicio compartido de estados de clientes; `estructura-carpetas` asigna HU-03, HU-04 y HU-05 a `change-client-status.service.ts`).
   - *Orden de validación:* motivo (`400`) → cliente existe (`404`) → ya desactivado (`409` «El cliente está desactivado») → actualizar estado y datos de la baja y auditar en la misma transacción.

3. **Mensaje «El cliente está desactivado» (decisión del PO)**
   - Se usa al intentar dar de baja un cliente ya de baja y al registrar un paciente de un cliente `DEACTIVATED`. Para clientes `INACTIVE` el registro de pacientes mantiene el mensaje de HU-07.

4. **Auditoría con la nueva acción "Dar de baja"**
   - *Decisión:* agregar `deactivate: 'Dar de baja'` a `AUDIT_ACTIONS` y registrar `{ action: deactivate, module: clients, affectedRecord: describePerson(person), previousValue: { status: 'Activo' | 'Inactivo' }, newValue: { status: 'De baja', reason } }`.
   - *Alternativa descartada:* reutilizar "Inactivar"; la baja es definitiva y debe poder filtrarse aparte en la consulta de auditoría (HU-60).

5. **Frontend**
   - Botón de icono «Dar de baja» en la fila (como «Inactivar» y «Activar»), modal propio con `textarea`, contador hasta 500 y aviso de acción definitiva. Los clientes `DEACTIVATED` ocultan todas las acciones de cambio y muestran en su detalle los datos de la baja.
   - Validación del motivo en cliente y servidor con el mismo mensaje.

## Risks / Trade-offs

- [Cambio de esquema compartido] → Migración pequeña y aditiva (columnas opcionales); se avisa al grupo antes de crearla.
- [Se puede dar de baja un cliente con citas pendientes mientras no exista la verificación con el Módulo 2] → Se documenta como pendiente en la HU y en el PR; el cambio aparte se prioriza cuando se apruebe.
- [Migraciones fuera de orden en bases nuevas (defecto QA DEF-12)] → Crear la migración sobre la rama actualizada y verificarla con `prisma migrate reset` en una base vacía.

## Migration Plan

1. `make up` (PostgreSQL `55432`, API `3080`, frontend `5174`).
2. `docker compose exec -T api npx prisma migrate dev --name add_client_deactivation`.
3. Verificar en base vacía: `docker compose exec -T api npx prisma migrate reset --force`.
4. Rollback: la migración solo agrega columnas opcionales; revertir es eliminarlas en una migración nueva.

## Open Questions

- ¿La ficha del cliente debe mostrar el nombre del responsable de la baja a todos los roles con `clients:read`, o solo a Gerente y Veterinario?
