## Why

En el Módulo 1 (Historial Clínico), el Administrador necesita suspender temporalmente el acceso de un usuario del personal (por ejemplo, por vacaciones o suspensión) y reactivarlo posteriormente sin eliminar su cuenta ni perder la trazabilidad de las atenciones y registros que realizó (**HU-55 · Activar e inactivar cuenta de usuario**, issue `#26`, Sprint 2). Además, desbloquea la implementación de **HU-61** (*Dar de baja usuario*) y mitiga el riesgo **R-12** garantizando el cierre inmediato de sesiones abiertas al inactivar una cuenta.

Documentación funcional de referencia:
- `docs/modulo-1-historial-clinico/historias-usuario/08-autenticacion-usuarios.md` (HU-55, RF-59)
- `docs/modulo-1-historial-clinico/matriz-roles-permisos.md` (sección 2.1: permiso `users:change-status` exclusivo para Administrador)
- `docs/modulo-1-historial-clinico/diagramas/clases.md` (sección 4: estados `Activo`, `Inactivo`, `DadoDeBaja`)

## What Changes

- Agregar el servicio `ChangeUserStatusService` en `vet-manage-api/src/modules/identity/services/change-user-status.service.ts` para inactivar (`ACTIVE` → `INACTIVE`) y activar (`INACTIVE` → `ACTIVE`) cuentas de usuario, validando:
  - Existencia del usuario y que no esté dado de baja (`DEACTIVATED`).
  - Prohibición de inactivar la propia cuenta del Administrador autenticado (`"No puede inactivar su propia cuenta"`).
  - Prohibición de inactivar al último Administrador activo del sistema (`"Debe existir al menos un Administrador activo"`).
  - Revocación atómica de todas las sesiones activas (`UserSession.revokedAt`) al inactivar la cuenta para asegurar cierre de sesión inmediato en la siguiente acción (R-12).
  - Conservación íntegra de todos los registros históricos y roles del usuario.
- Exponer el endpoint `PATCH /api/v1/users/:id/status` en `UsersController`, protegido con `JwtAuthGuard` y `@RequirePermissions('users:change-status')`.
- Extender `AUDIT_ACTIONS` en `vet-manage-api/src/modules/audit/audit.catalog.ts` con `inactivate: 'Inactivar'` y `activate: 'Activar'`, y registrar cada cambio de estado dentro de la misma transacción Prisma con `previousValue` y `newValue`.
- Incorporar en la pantalla de consulta de usuarios (`vet-manage-frontend/src/modules/users/pages/users-page.tsx`) las acciones **Inactivar** (para cuentas activas) y **Activar** (para cuentas inactivas), visibles solo con el permiso `users:change-status`, con diálogo de confirmación y opción de cancelar, refresco del listado y mensajes claros de éxito/error.
- Añadir pruebas unitarias de backend (`change-user-status.service.spec.ts`), pruebas de integración/e2e del endpoint y pruebas unitarias de frontend (`users-page.test.tsx`, `users-api.test.ts`).

## Capabilities

### New Capabilities
- `user-status-management`: Activación e inactivación temporal de cuentas de usuario en el backend (`PATCH /api/v1/users/:id/status`), validaciones de negocio (propia cuenta, último administrador activo, cuenta dada de baja), revocación de sesiones activas y control de acceso por permiso `users:change-status`.
- `user-status-management-ui`: Interfaz en el listado de usuarios para inactivar y activar cuentas con confirmación/cancelación, visibilidad controlada por permiso `users:change-status` y manejo de mensajes de confirmación y error.

### Modified Capabilities
- `audit-log`: Incorporar las acciones `"Inactivar"` y `"Activar"` en el catálogo compartido de auditoría y registrar atómicamente cada cambio de estado de cuenta de usuario con su estado anterior y nuevo.

## Impact

- **Backend (`vet-manage-api`)**:
  - `src/modules/audit/audit.catalog.ts` (nuevas acciones `inactivate`, `activate`).
  - `src/modules/identity/dtos/change-user-status.dto.ts` (nuevo DTO).
  - `src/modules/identity/services/change-user-status.service.ts` y `change-user-status.service.spec.ts` (nuevo servicio + pruebas).
  - `src/modules/identity/users.controller.ts` y `identity.module.ts` (nuevo endpoint y registro del servicio).
  - No requiere cambios en el esquema Prisma (`User.status` ya usa `RecordStatus` y `UserSession.revokedAt` ya existe).
- **Frontend (`vet-manage-frontend`)**:
  - `src/modules/users/services/users-api.ts` y `users-api.test.ts`.
  - `src/modules/users/pages/users-page.tsx`, `users-page.css` y `users-page.test.tsx`.
- **Seguridad y auditoría**: Cumple R-12 (invalidación de sesión activa en la siguiente petición mediante `JwtAuthGuard` + revocación de `UserSession`) y trazabilidad completa vía `AuditService`.
