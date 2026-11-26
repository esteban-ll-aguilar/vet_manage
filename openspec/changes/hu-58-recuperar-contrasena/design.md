## Context

- `identity` ya tiene `PasswordHasher`, la política común `src/common/security/password-policy.ts` (`isValidPassword`, `PASSWORD_POLICY_MESSAGE`), `ChangePasswordService` (HU-59) y `SessionService` (refresh tokens en `user_sessions`, con `revokedAt`).
- `MailService` envía con plantillas (`src/infrastructure/mail/templates/`, `renderEmailLayout`); en desarrollo los correos se ven en Mailpit (`http://localhost:58025`). `APP_URL` (`configuration.ts`, por defecto `http://localhost:5174`) ya se usa para el enlace de inicio de sesión del correo de credenciales.
- `AuthService` ya resuelve la enumeración de cuentas en el login (mismo mensaje y contador en Redis para correos desconocidos).
- Auditoría (HT-04): registro en la misma transacción, actor obligatorio (FK a `users`), catálogo compartido.
- Frontend: `LoginPage` muestra «¿Olvidaste tu contraseña? Comunícate con el administrador del sistema.»; `AppRouter` tiene `login` como única ruta pública.

## Goals / Non-Goals

**Goals:**
- Recuperación por enlace de un solo uso, válido 30 minutos, sin revelar si un correo existe.
- Distinguir enlace vencido («ha expirado») de enlace usado o reemplazado («no es válido»), como piden los escenarios 3 y 4.
- Auditar la solicitud y el restablecimiento sin guardar secretos.

**Non-Goals:**
- Cambio de contraseña con sesión iniciada (HU-59, ya implementado).
- Recuperación para cuentas inactivas o dadas de baja: esas cuentas deben pasar por el Administrador (HU-55).
- Página de consulta de auditoría (HU-60).

## Decisions

1. **Tabla `password_reset_tokens` en lugar de Redis o JWT**
   - *Decisión:* modelo `PasswordResetToken { id, userId, tokenHash (unique, sha256), expiresAt, usedAt?, replacedAt?, createdAt }` en `prisma/schema/identity.prisma`, FK a `User` con `onDelete: Cascade`.
   - *Alternativas:* (a) clave en Redis con TTL: al vencer, la clave desaparece y ya no se puede distinguir «expirado» de «no válido»; (b) JWT firmado con `exp`: no permite marcar el enlace como usado ni reemplazado sin guardar estado igualmente.
   - Se guarda solo el hash (como `refreshTokenHash` en `UserSession`), así una filtración de la base no permite usar los enlaces.

2. **Token y enlace**
   - `randomBytes(32).toString('base64url')`; enlace `${APP_URL}/reset-password?token=<token>`.
   - Estado al validar: no existe, `usedAt` o `replacedAt` → «no válido» (`400`); `expiresAt <= ahora` → «expirado» (`410`); en otro caso vigente.

3. **Respuesta uniforme y sin diferencia de tiempos**
   - La solicitud responde siempre el mismo `200`. El envío del correo se hace después de confirmar la transacción y sus errores solo se registran en el log, para que un fallo de SMTP no delate que la cuenta existe.
   - Límite (HU-58 Esc. 8, aprobado por el PO): contador en Redis `auth:password-reset:<sha256(email)>` con ventana de 15 minutos y máximo 3 (mismo patrón que `auth.service.ts`). Si Redis falla, se permite la solicitud y se registra una advertencia.

4. **Endpoints públicos en `AuthController`**
   - `POST /auth/password-reset/request`, `GET /auth/password-reset/validate`, `POST /auth/password-reset/confirm`, todos `@HttpCode(200)` y sin `@Authenticated()`, como `login` y `refresh`.
   - Lógica en `RecoverPasswordService` (`src/modules/identity/services/recover-password.service.ts`, nombre previsto en `estructura-carpetas`) y acceso a la tabla en `repositories/password-reset-token.repository.ts`.

5. **Restablecimiento atómico**
   - En una transacción: actualizar `User.password`, `mustChangePassword = false`, `failedLoginAttempts = 0`, `isLocked = false`, `lockedAt = null`; marcar el token con `usedAt`; revocar todas las sesiones abiertas del usuario (`SessionService.revokeAllForUser(userId, tx)`, método nuevo); y auditar "Restablecer contraseña".
   - Validaciones con los mensajes y la política ya usados en HU-59 (se reutiliza `password-policy.ts`).

6. **Auditoría**
   - Catálogo: `requestPasswordReset: 'Solicitar recuperación'` y `resetPassword: 'Restablecer contraseña'`.
   - Actor: el titular de la cuenta (no hay sesión). `affectedRecord: describePerson(person)`; sin `previousValue` ni `newValue` para no guardar secretos.

7. **Frontend**
   - Rutas públicas `forgot-password` y `reset-password` fuera de `RequireAuth`, con el mismo diseño de `LoginPage`.
   - `LoginPage`: enlace «¿Olvidó su contraseña?» (pasa el correo escrito por `state`) y aviso de éxito cuando llega desde el restablecimiento.

## Risks / Trade-offs

- [Cambio de esquema compartido] → Tabla nueva aislada; se avisa al grupo y se verifica la migración en una base vacía (defecto QA DEF-12 sobre el orden de migraciones).
- [Enlaces interceptados en el correo] → Vigencia de 30 minutos, un solo uso, reemplazo al pedir otro y cierre de sesiones al restablecer.
- [Abuso del endpoint público para enviar correos] → Límite de 3 solicitudes por correo cada 15 minutos; respuesta uniforme.
- [Tabla que crece] → Tarea opcional de limpieza de tokens vencidos de más de 7 días; no bloquea la HU.

## Migration Plan

1. `make up` (PostgreSQL `55432`, Redis `56379`, API `3080`, frontend `5174`, Mailpit `58025`).
2. `docker compose exec -T api npx prisma migrate dev --name add_password_reset_tokens`.
3. Verificar en base vacía: `docker compose exec -T api npx prisma migrate reset --force`.
4. Variable nueva opcional `PASSWORD_RESET_TTL_MINUTES` (por defecto `30`) en `.env.example` y `docker-compose.yml`.
5. Rollback: eliminar la tabla en una migración nueva; no afecta datos existentes.

## Open Questions

- ¿Las cuentas de rol Cliente (que hoy reciben credenciales al registrarse) también usan esta recuperación? La matriz de roles dice que sí; se implementa para todas las cuentas activas.
