## Context

El módulo `identity` en `vet-manage-api` ya cuenta con:
- `User.password` y `User.mustChangePassword` en `prisma/schema/identity.prisma` (al registrar un usuario en HU-51 se asigna contraseña temporal y `mustChangePassword = true`).
- `PasswordHasher` (`hash` y `verify`) en `src/modules/identity/services/password-hasher.service.ts`.
- `AuthController` (`src/modules/identity/auth.controller.ts`) con decorador `@Authenticated()` (`JwtAuthGuard`, accesible para cualquier rol con sesión activa).
- `AccessService.getSessionProfile(userId)` ya devuelve `mustChangePassword` en el perfil de sesión (`/auth/login`, `/auth/refresh`, `/auth/me`).
- En `vet-manage-frontend`, `AuthProvider` mantiene `session.mustChangePassword`, `RequireAuth` protege las rutas privadas y `UserMenu` (`src/common/layouts/user-menu.tsx`) contiene las opciones de cuenta del usuario autenticado.

## Goals / Non-Goals

**Goals:**
- Exponer `POST /api/v1/auth/change-password` protegido con `@Authenticated()` (todos los roles).
- Validar contraseña actual, política de nueva contraseña (`>= 8` caracteres, mayúscula, minúscula, número), coincidencia de confirmación y diferencia respecto a la contraseña actual, devolviendo los mensajes exactos de HU-59.
- Actualizar el hash en `User.password` y poner `mustChangePassword = false` dentro de una transacción Prisma junto con el registro atómico en auditoría (`Cambiar contraseña`, módulo `Usuarios`, sin almacenar contraseñas).
- Implementar la pantalla `/change-password` accesible desde `UserMenu` y obligatoria en `LoginPage` + `RequireAuth` cuando `session.mustChangePassword === true`.

**Non-Goals:**
- Recuperación de contraseña olvidada por correo electrónico: corresponde a **HU-58** (Christian Robles).
- Bloqueo por intentos fallidos en cambio de contraseña: HU-59 indica explícitamente que valida actual y nueva sin bloqueos.
- Migraciones de base de datos: no se requieren cambios en `prisma/schema/`.

## Decisions

1. **Endpoint `POST /api/v1/auth/change-password` en `AuthController` con `@Authenticated()`**
   - *Decisión:* Exponer `POST /api/v1/auth/change-password` con `@HttpCode(200)` y `@Authenticated()`.
   - *Justificación:* Según `matriz-roles-permisos.md` (Parte 1) y `estructura-carpetas.md`, cambiar contraseña es una función general disponible para todos los roles del sistema y pertenece a `auth.controller.ts` + `change-password.service.ts`.

2. **Orden de validaciones de negocio en `ChangePasswordService`**
   - *Decisión:*
     1. Validar que los campos obligatorios no estén vacíos (`400`).
     2. Verificar la contraseña actual con `PasswordHasher.verify(currentPassword, user.password)`. Si no coincide → `400` `"La contraseña actual no es correcta"`.
     3. Verificar coincidencia `newPassword === confirmPassword`. Si difieren → `400` `"Las contraseñas no coinciden"`.
     4. Verificar política de seguridad (`/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/`). Si no cumple → `400` `"La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número"`.
     5. Verificar que `newPassword !== currentPassword` (y `!(await hasher.verify(newPassword, user.password))`). Si es igual → `400` `"La nueva contraseña debe ser diferente a la actual"`.
   - *Justificación:* Garantiza mensajes claros y exactos para cada uno de los escenarios 1 a 5 de HU-59, tanto si el cliente envía los datos desde la UI como directamente a la API.

3. **Auditoría segura (sin exponer contraseñas)**
   - *Decisión:* Agregar `changePassword: 'Cambiar contraseña'` a `AUDIT_ACTIONS` en `src/modules/audit/audit.catalog.ts` y registrar `AuditService.record(tx, { actorId: userId, action: AUDIT_ACTIONS.changePassword, module: AUDIT_MODULES.users, affectedRecord: describePerson(user.person) })` sin `previousValue` ni `newValue` (o nunca incluir contraseñas/hashes).
   - *Justificación:* Cumple trazabilidad total de HT-04 sin filtrar secretos en `audit_logs`.

4. **Flujo obligatorio de primer ingreso (`mustChangePassword`) en Frontend**
   - *Decisión:*
     - En `AuthProvider` / `AuthContext`, agregar `clearMustChangePassword()` (actualiza `session.mustChangePassword = false` en memoria tras cambiar la contraseña exitosamente).
     - En `LoginPage`, tras `const profile = await login(...)`, navegar a `profile.mustChangePassword ? '/change-password' : from`.
     - En `RequireAuth`, si `session?.mustChangePassword && location.pathname !== '/change-password'`, redirigir con `<Navigate to="/change-password" replace />`.
     - En `AppRouter`, registrar `<Route path="change-password" element={<ChangePasswordPage />} />` dentro de `AppShell` (bajo `RequireAuth`). Así, si el usuario intenta abrir cualquier otra pantalla mientras `mustChangePassword` es `true`, `RequireAuth` lo regresa automáticamente a `/change-password` (Escenarios 6 y 7).
     - En `UserMenu`, agregar el ítem **Cambiar contraseña** navegando a `/change-password`.

## Risks / Trade-offs

- **[Validación de nueva contraseña en cliente vs servidor]** → Aplicar la misma regla en ambos lados para feedback instantáneo en UI sin perder seguridad si se llama directo a la API.
- **[Mantener sesión activa tras cambiar contraseña]** → En HU-59 el usuario permanece autenticado con su nueva contraseña y `mustChangePassword` pasa a `false`; si estaba en primer ingreso, se redirige a `/` o se habilita la navegación normal con un mensaje de confirmación.

## Entorno local y verificación

- **Servicios Docker:** PostgreSQL (`55432`), Redis (`56379`), RabbitMQ (`5672` / UI `15673`), API (`3080`), Frontend (`5174`).
- **Comandos de verificación:**
  - Backend: `docker compose exec -T api sh -c 'npm test && npm run lint && npx tsc -p tsconfig.build.json --noEmit'`
  - Frontend: `docker compose exec -T frontend sh -c 'npm test && npm run lint && npm run build'`
