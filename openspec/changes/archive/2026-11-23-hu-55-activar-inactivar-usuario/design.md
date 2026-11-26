## Context

El módulo `identity` en `vet-manage-api` ya cuenta con:
- Modelo `User` en `prisma/schema/identity.prisma` con `status: RecordStatus` (`ACTIVE`, `INACTIVE`, `DEACTIVATED`) y `UserSession` con `revokedAt`.
- Permiso `users:change-status` (`"Activar e inactivar cuentas"`) ya declarado en `src/config/permissions/identity.permissions.ts` y asignado al rol `administrator`.
- `JwtAuthGuard` verifica en cada solicitud `AccessService.findActiveUser(userId)`, rechazando con `401` si `user.status !== 'ACTIVE'`.
- `SessionService.rotate()` verifica `session.user?.status !== 'ACTIVE'` y rechaza la renovación de refresh tokens.
- `AuthService.login()` ya rechaza cuentas `INACTIVE` o `DEACTIVATED` con `"Su cuenta se encuentra desactivada. Contacte al administrador"`.
- `AuditService.record(tx, entry)` registra entradas de auditoría con `previousValue` y `newValue` dentro de la misma transacción Prisma.
- En `vet-manage-frontend`, `UsersPage` (`src/modules/users/pages/users-page.tsx`) lista los usuarios con su estado y acciones filtradas por `hasPermission(...)`.

Esta HU (`HU-55`) implementa la activación e inactivación temporal de cuentas y prepara `ChangeUserStatusService` de forma extensible para `HU-61` (*Dar de baja usuario*).

## Goals / Non-Goals

**Goals:**
- Exponer `PATCH /api/v1/users/:id/status` protegido con `JwtAuthGuard` y `@RequirePermissions('users:change-status')`.
- Implementar `ChangeUserStatusService` con todas las reglas de negocio de HU-55 (propia cuenta, último administrador activo, cuenta dada de baja, conservación de datos históricos).
- Garantizar el cumplimiento de **R-12** revocando todas las sesiones activas (`UserSession`) del usuario al inactivarlo, además del rechazo inmediato en `JwtAuthGuard`.
- Registrar cada transición de estado en `audit_logs` dentro de la misma transacción Prisma con `previousValue` y `newValue`.
- Incorporar botones de **Inactivar** / **Activar** con diálogo de confirmación y opción de cancelar en `UsersPage`, controlados por `hasPermission('users:change-status')`.

**Non-Goals:**
- Dar de baja definitiva (`DEACTIVATED`, con motivo y fecha de baja): corresponde a **HU-61**.
- Cambiar contraseña o recuperar contraseña: corresponden a **HU-59** y **HU-58**.
- Migraciones de base de datos: no se requieren cambios en `prisma/schema/`.

## Decisions

1. **Endpoint único `PATCH /api/v1/users/:id/status` con `{ status: 'ACTIVE' | 'INACTIVE' }` vs endpoints separados (`/inactivate`, `/activate`)**
   - *Decisión:* Usar `PATCH /api/v1/users/:id/status` validado con `ChangeUserStatusDto` (`status: 'ACTIVE' | 'INACTIVE'`).
   - *Justificación:* Sigue el diseño de `estructura-carpetas.md` (un servicio `change-user-status.service.ts` para `HU-55` y `HU-61`), mantiene una interfaz REST uniforme para transiciones de estado y facilita que `HU-61` agregue la transición a `DEACTIVATED` o su propio método en el mismo servicio sin proliferar controladores.
   - *Alternativa considerada:* Dos endpoints `POST /users/:id/inactivate` y `POST /users/:id/activate`. Se descartó por duplicar rutas y DTOs cuando ambas comparten validaciones, transacción y respuesta.

2. **Revocación explícita de `UserSession` al inactivar (R-12)**
   - *Decisión:* Dentro de la misma transacción que actualiza `user.status = 'INACTIVE'`, ejecutar `tx.userSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } })`.
   - *Justificación:* Aunque `JwtAuthGuard` ya rechaza access tokens de usuarios inactivos en su siguiente acción y `SessionService.rotate` rechaza cuentas inactivas, revocar las sesiones existentes evita que un refresh token previo a la suspensión vuelva a ser válido si la cuenta se reactiva después.

3. **Protección del último Administrador activo**
   - *Decisión:* Reutilizar el mismo patrón de `UserRoleAssignmentService`: si el usuario objetivo está `ACTIVE`, se desea pasar a `INACTIVE` y posee el rol `administrator` activo y vigente (`expiresAt === null || expiresAt > now`), contar si existe al menos otro usuario `ACTIVE` con rol `administrator` activo y vigente. Si el conteo es `0`, lanzar `ApiException` (`400`, código `USER_STATUS_LAST_ADMIN`, mensaje `"Debe existir al menos un Administrador activo"`).

4. **Auditoría atómica con `previousValue` y `newValue`**
   - *Decisión:* Agregar `inactivate: 'Inactivar'` y `activate: 'Activar'` a `AUDIT_ACTIONS` en `src/modules/audit/audit.catalog.ts`. Registrar en `AuditService.record(tx, ...)` con `module: AUDIT_MODULES.users`, `affectedRecord: describePerson(user.person)`, `previousValue: { status: <etiqueta anterior> }` y `newValue: { status: <etiqueta nueva> }` (usando etiquetas legibles `'Activo'` / `'Inactivo'`). Si el estado ya coincide con el solicitado, no se genera un registro duplicado en auditoría.

5. **Interfaz en `UsersPage` con diálogo de confirmación**
   - *Decisión:* Mostrar la columna `Acciones` cuando `canAssignRoles || canChangeStatus`. Para cuentas `ACTIVE`, mostrar botón `"Inactivar"`; para `INACTIVE`, mostrar botón `"Activar"`; para `DEACTIVATED`, no mostrar botón de cambio de estado. Al pulsar cualquiera de los dos, abrir un modal/diálogo accesible (`role="dialog"`) con botones `"Confirmar"` y `"Cancelar"`. Si el backend rechaza (por ejemplo, propia cuenta o último administrador), mostrar el mensaje exacto del servidor en un aviso visible (`role="alert"`).

## Risks / Trade-offs

- **[Race condition al inactivar los dos últimos administradores simultáneamente]** → La verificación de último administrador y el `update` ocurren dentro de la misma transacción Prisma; el riesgo residual de concurrencia simultánea entre dos admins es mínimo en el volumen operativo de una clínica.
- **[Conflicto con HU-61 en `change-user-status.service.ts`]** → Mantener el servicio modular y limpio (mensajes en constante exportada `USER_STATUS_MESSAGES`, helpers claros) para que `HU-61` pueda extenderlo con bajo acoplamiento.
- **[Diferencia entre HTTP `401` en acceso concurrente y UX de sesión cerrada]** → `http-client.ts` y `AuthProvider` ya manejan `401` intentando refresh y disparando `sessionToken.onExpired` para redirigir al login en la siguiente acción del usuario inactivado.

## Entorno local y verificación

- **Servicios Docker:** PostgreSQL (`55432`), Redis (`56379`), RabbitMQ (`5672` / UI `15673`), API (`3080`), Frontend (`5174`).
- **Variables de entorno:** `.env` (copiado desde `.env.example`).
- **Comandos de verificación:**
  - Arranque local: `make up`
  - Pruebas backend: `cd vet-manage-api && npm test`
  - Pruebas frontend: `cd vet-manage-frontend && npm test`
  - Lint y build: `make lint && make build`
