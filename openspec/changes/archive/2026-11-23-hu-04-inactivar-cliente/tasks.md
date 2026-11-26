## 1. Backend – Inactivación de clientes (`clients`)

- [x] 1.1 Crear `vet-manage-api/src/modules/clients/services/change-client-status.service.ts` con `inactivate(clientId, actorId)`:
  - validar que el cliente existe (`404` `"Cliente no encontrado"`),
  - rechazar clientes dados de baja (`DEACTIVATED`, `400` `"No se puede inactivar un cliente dado de baja"`),
  - actualizar `Client.status` a `INACTIVE` conservando datos y mascotas vinculadas,
  - registrar atómicamente en auditoría (`AuditService.record`) con acción `AUDIT_ACTIONS.inactivate`, módulo `AUDIT_MODULES.clients`, `affectedRecord` y `previousValue` / `newValue`, sin duplicar auditoría si ya estaba `INACTIVE`.
- [x] 1.2 Importar `AuditModule` y registrar `ChangeClientStatusService` en `vet-manage-api/src/modules/clients/clients.module.ts`.
- [x] 1.3 Exponer `PATCH /clients/:clientId/inactivate` en `vet-manage-api/src/modules/clients/routes/clients.controller.ts` con `ParseUUIDPipe` y `@RequirePermissions('clients:inactivate')`.

## 2. Pruebas de backend

- [x] 2.1 Crear `vet-manage-api/src/modules/clients/services/change-client-status.service.spec.ts` cubriendo inactivación exitosa, auditoría atómica, cliente inexistente (`404`), cliente dado de baja (`400`), no-op idempotente sin auditoría duplicada y metadato de permiso `clients:inactivate`.
- [x] 2.2 Actualizar `vet-manage-api/src/modules/clients/routes/clients.controller.spec.ts` verificando el endpoint `inactivate` y su permiso `clients:inactivate`.

## 3. Frontend – Inactivación de clientes en `ClientsPage`

- [x] 3.1 Agregar `InactivatedClient` en `vet-manage-frontend/src/modules/clients/types.ts` y `inactivate(clientId)` en `vet-manage-frontend/src/modules/clients/services/clients-api.ts`, junto con su prueba en `clients-api.test.ts`.
- [x] 3.2 Actualizar `vet-manage-frontend/src/modules/clients/pages/clients-page.tsx` y `clients-page.css` para:
  - mostrar el botón de icono `"Inactivar"` con tooltip solo con `hasPermission('clients:inactivate')` y en clientes con estado `ACTIVE`,
  - abrir un modal de confirmación elegante (consistente con `UsersPage`) con transición `Activo → Inactivo`, `"Cancelar"` y `"Confirmar"`,
  - actualizar el estado en la tabla, mostrar avisos de confirmación/error y mantener los badges diferenciados (`Activo` verde, `Inactivo` rojo coral, `De baja` gris) y la consulta de mascotas disponible para clientes inactivos.
- [x] 3.3 Ampliar `vet-manage-frontend/src/modules/clients/pages/clients-page.test.tsx` cubriendo visibilidad por permiso, confirmación de inactivación, cancelación, ausencia del botón en `INACTIVE` / `DEACTIVATED`, consulta de mascotas de un cliente inactivo y visualización de errores del backend.

## 4. Verificación final

- [x] 4.1 Ejecutar pruebas, lint y build de backend y frontend en Docker (`api` y `frontend`).
