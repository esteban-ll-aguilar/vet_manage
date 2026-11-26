## 1. Catálogo de auditoría

- [x] 1.1 Agregar `inactivate: 'Inactivar'` y `activate: 'Activar'` a `AUDIT_ACTIONS` en `vet-manage-api/src/modules/audit/audit.catalog.ts`.

## 2. Backend – Cambio de estado de usuario (`identity`)

- [x] 2.1 Crear `vet-manage-api/src/modules/identity/dtos/change-user-status.dto.ts` validando que `status` sea `'ACTIVE'` o `'INACTIVE'`.
- [x] 2.2 Crear `vet-manage-api/src/modules/identity/services/change-user-status.service.ts` con:
  - validación de usuario existente (`404` `"Usuario no encontrado"`),
  - rechazo de cuentas dadas de baja (`DEACTIVATED`),
  - rechazo de auto-inactivación (`400` `"No puede inactivar su propia cuenta"`),
  - protección del último Administrador activo (`400` `"Debe existir al menos un Administrador activo"`),
  - actualización de `User.status` + revocación de `UserSession` activas al inactivar (R-12) dentro de una transacción Prisma,
  - registro atómico en auditoría (`AuditService.record`) con acción `"Inactivar"`/`"Activar"`, módulo `"Usuarios"`, `affectedRecord` y `previousValue`/`newValue`.
- [x] 2.3 Registrar `ChangeUserStatusService` en `vet-manage-api/src/modules/identity/identity.module.ts` y exponer `PATCH /users/:id/status` en `vet-manage-api/src/modules/identity/users.controller.ts` protegido con `@RequirePermissions('users:change-status')`.

## 3. Pruebas de backend

- [x] 3.1 Crear pruebas unitarias en `vet-manage-api/src/modules/identity/services/change-user-status.service.spec.ts` cubriendo inactivación exitosa, reactivación exitosa, revocación de sesiones, auto-inactivación, último administrador activo, usuario dado de baja, usuario inexistente, no-op sin auditoría duplicada y auditoría atómica.
- [x] 3.2 Verificar autorización (`403` sin permiso `users:change-status`), rechazo en login de cuenta inactiva y rechazo `401` en siguiente acción de usuario con sesión abierta tras inactivación (R-12).

## 4. Frontend – Acciones de activar/inactivar en `UsersPage`

- [x] 4.1 Agregar `changeStatus(userId, status)` en `vet-manage-frontend/src/modules/users/services/users-api.ts` (y `patchJson` en `http-client.ts` si aún no existe) y sus pruebas en `users-api.test.ts`.
- [x] 4.2 Actualizar `vet-manage-frontend/src/modules/users/pages/users-page.tsx` y `users-page.css` para mostrar `"Inactivar"` (cuentas `ACTIVE`) y `"Activar"` (cuentas `INACTIVE`) solo con `hasPermission('users:change-status')`, abrir diálogo de confirmación con `"Confirmar"` y `"Cancelar"`, refrescar el listado y mostrar mensajes de éxito o error del backend.
- [x] 4.3 Ampliar `vet-manage-frontend/src/modules/users/pages/users-page.test.tsx` cubriendo visibilidad por permiso, confirmación de inactivación, cancelación de inactivación, confirmación de activación, ausencia de acciones en cuentas `DEACTIVATED` y visualización de errores del servidor.

## 5. Verificación final

- [x] 5.1 Ejecutar pruebas unitarias y de integración de backend (`cd vet-manage-api && npm test`), pruebas de frontend (`cd vet-manage-frontend && npm test`), lint (`make lint`) y build (`make build`).
