## 1. Base de datos

- [x] 1.1 Avisar al grupo del cambio de esquema y agregar a `Client` (`prisma/schema/identity.prisma`) `deactivatedAt`, `deactivatedById` (relación a `User`, `onDelete: Restrict`) y `deactivationReason` (`VarChar(500)`).
- [x] 1.2 Crear la migración `20261124120000_add_client_deactivation` (SQL generada con `prisma migrate diff` desde el esquema anterior). Verificación sobre una base vacía con `prisma migrate reset`: a cargo de QA (la base local de desarrollo tiene la migración de agendamiento fallida, defecto DEF-12).

## 2. Auditoría

- [x] 2.1 Agregar `deactivate: 'Dar de baja'` a `AUDIT_ACTIONS` en `src/modules/audit/audit.catalog.ts` y actualizar la prueba del catálogo.

## 3. Backend – Baja de clientes

- [x] 3.1 Crear `src/modules/clients/dtos/deactivate-client.dto.ts` (`reason` opcional en el DTO; la validación de negocio la hace el servicio para responder con los mensajes de la HU).
- [x] 3.2 Agregar `deactivate(clientId, reason, actorId)` a `ChangeClientStatusService`: motivo obligatorio de 1 a 500 caracteres (`400`), cliente inexistente (`404`), ya desactivado (`409` «El cliente está desactivado»), actualización de estado y datos de la baja, y auditoría "Dar de baja" en la misma transacción.
- [x] 3.3 Exponer `PATCH /clients/:clientId/deactivate` en `clients.controller.ts` con `ParseUUIDPipe` y `@RequirePermissions('clients:deactivate')`.
- [x] 3.4 Devolver `deactivatedAt`, `deactivationReason` y el nombre del responsable en el listado/detalle de clientes (`clients.repository.ts`, `client-response.dto.ts`).
- [x] 3.5 En `RegisterPatientService`, responder «El cliente está desactivado» (`409`) para clientes `DEACTIVATED`, manteniendo el mensaje de HU-07 para `INACTIVE`.

## 4. Pruebas de backend (positivos, negativos y valor límite)

- [x] 4.1 `change-client-status.service.spec.ts` — positivos: baja desde Activo y desde Inactivo, datos de la baja guardados y motivo recortado; negativos: sin motivo, motivo en blanco, cliente inexistente, ya desactivado, fallo de auditoría revierte; límite: motivo de 1, 500 y 501 caracteres; auditoría con valores anterior y nuevo y sin registro al rechazar.
- [x] 4.2 `clients.controller.spec.ts`: endpoint, `ParseUUIDPipe` y permiso `clients:deactivate`.
- [x] 4.3 `register-patient.service.spec.ts`: cliente `DEACTIVATED` con «El cliente está desactivado» y cliente `INACTIVE` con el mensaje de HU-07.
- [ ] 4.4 Prueba e2e en `test/clients/`: baja con Gerente, `403` con Recepcionista y Técnico, `401` sin sesión, registro en `audit_logs` y edición rechazada después de la baja. **A cargo de QA (decisión del equipo: las e2e con base real las ejecutan los testers).**

## 5. Frontend – Acción «Dar de baja»

- [x] 5.1 Agregar `deactivate(clientId, reason)` y los campos de la baja en `src/modules/clients/services/clients-api.ts` y `types.ts`, con su prueba.
- [x] 5.2 En `clients-page.tsx` / `clients-page.css`: botón «Dar de baja» solo con `clients:deactivate` y estado `ACTIVE`/`INACTIVE`; modal con motivo obligatorio y contador hasta 500, transición `→ De baja`, «Cancelar» sin cambios y «Confirmar baja».
- [x] 5.3 Vista de un cliente `De baja` en solo lectura con fecha, responsable, motivo y mascotas; sin acciones de edición ni cambio de estado.
- [x] 5.4 Pruebas en `clients-page.test.tsx` — positivos: baja confirmada y vista de solo lectura; negativos: sin permiso, motivo vacío, error de la API, cancelación; límite: motivo de 500 caracteres.

## 6. Verificación final

- [x] 6.1 Ejecutar `docker compose exec -T api sh -c 'npm test && npm run lint && npx tsc -p tsconfig.build.json --noEmit'` y `docker compose exec -T frontend sh -c 'npm test && npm run lint && npm run build'`.
- [ ] 6.2 Verificar en `audit_logs` el registro "Dar de baja" con valor anterior y nuevo tras una baja real.

## 7. Pendiente (cambio aparte, requiere aprobación del Módulo 2)

- [ ] 7.1 Verificar citas futuras `PROGRAMADA`/`CONFIRMADA` antes de la baja (HU-03 Esc. 2) mediante un servicio del dominio de agenda. No se implementa en este cambio.
