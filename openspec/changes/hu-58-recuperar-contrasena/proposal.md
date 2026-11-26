## Why

Hoy, si un usuario olvida su contraseña, la pantalla de inicio de sesión solo dice «Comunícate con el administrador del sistema» y el Administrador no tiene una forma segura de devolverle el acceso. **HU-58 · Recuperar contraseña** (RF-62, Sprint 2) pide que cualquier usuario con cuenta activa pueda restablecerla con un enlace enviado a su correo, válido por 30 minutos, sin revelar si un correo está registrado. HU-59 (cambiar contraseña) ya dejó lista la política de contraseñas y la auditoría "Cambiar contraseña", y la dejó fuera de su alcance explícitamente.

Documentación funcional de referencia:
- `docs/modulo-1-historial-clinico/historias-usuario/08-autenticacion-usuarios.md` (HU-58, RF-62)
- `docs/modulo-1-historial-clinico/matriz-roles-permisos.md` (Parte 1: «Recuperar contraseña» es una función general para todos los roles, incluido Cliente)
- Plan de pruebas: riesgo R-10 (gestión de credenciales) y objetivos OC-03 (autenticidad) y OC-04 (responsabilidad)

## What Changes

- Guardar las solicitudes de recuperación en una tabla nueva `password_reset_tokens` (solo el hash del token, vencimiento, fecha de uso y de reemplazo). **Requiere migración** de Prisma (se avisa al grupo antes de crearla).
- Endpoints públicos (sin sesión) en `AuthController`:
  - `POST /api/v1/auth/password-reset/request` `{ email }`: responde siempre «Si el correo está registrado, recibirá un enlace»; solo envía el enlace a cuentas activas e invalida los enlaces anteriores de esa cuenta.
  - `GET /api/v1/auth/password-reset/validate?token=…`: indica si el enlace sigue vigente, ya venció o no es válido, para mostrarlo al abrirlo.
  - `POST /api/v1/auth/password-reset/confirm` `{ token, newPassword, confirmPassword }`: valida el enlace, la coincidencia y la política, actualiza la contraseña y marca el enlace como usado.
- Nuevo servicio `RecoverPasswordService` (`src/modules/identity/services/recover-password.service.ts`, nombre previsto en la estructura de carpetas) y plantilla de correo `password-reset-email.ts`.
- Al restablecer: `mustChangePassword = false`, reinicio del contador de intentos y del bloqueo temporal, y cierre de todas las sesiones abiertas de la cuenta.
- Auditoría en la misma transacción con dos acciones nuevas del catálogo: **"Solicitar recuperación"** (cuando el correo pertenece a una cuenta activa) y **"Restablecer contraseña"**. Nunca se guarda el token ni la contraseña.
- Límite de **3 solicitudes por correo cada 15 minutos**, aprobado por el PO como nuevo criterio de aceptación (HU-58 Esc. 8, agregado en `docs/modulo-1-historial-clinico/historias-usuario/08-autenticacion-usuarios.md`).
- Pruebas con casos positivos, negativos y de valor límite (vigencia 29:59 / 30:00, contraseña de 7 / 8 caracteres, 3.ª / 4.ª solicitud).
- Frontend: enlace «¿Olvidó su contraseña?» en `LoginPage` (reemplaza el texto de ayuda actual), página pública `/forgot-password` y página pública `/reset-password?token=…`.

## Capabilities

### New Capabilities
- `password-reset`: Recuperación de contraseña en la API: solicitud con respuesta uniforme, enlace de un solo uso válido 30 minutos, reemplazo de enlaces anteriores, validación del enlace, restablecimiento con la política de contraseñas, cierre de sesiones y límite de solicitudes.
- `password-reset-ui`: Pantallas públicas «¿Olvidó su contraseña?» y «Restablecer contraseña» con los mensajes de la HU, validación en cliente y regreso al inicio de sesión.

### Modified Capabilities
- `login-ui`: La pantalla de inicio de sesión ofrece el enlace «¿Olvidó su contraseña?» en lugar del texto que remite al administrador.
- `audit-log`: Nuevas acciones del catálogo "Solicitar recuperación" y "Restablecer contraseña", auditadas con el titular de la cuenta como actor y sin guardar secretos.

## Impact

- **Base de datos**: migración `add_password_reset_tokens` (tabla nueva con FK a `users`, `onDelete: Cascade`). No toca tablas existentes.
- **Backend (`vet-manage-api`)**:
  - `src/modules/identity/auth.controller.ts`, `services/recover-password.service.ts` (+ `.spec.ts`), `dtos/password-reset-*.dto.ts`, `repositories/password-reset-token.repository.ts`.
  - `src/modules/identity/services/session.service.ts` (cerrar todas las sesiones de un usuario).
  - `src/infrastructure/mail/templates/password-reset-email.ts` (+ `.spec.ts`).
  - `src/modules/audit/audit.catalog.ts`.
  - `src/config/env.validation.ts` / `configuration.ts`: `PASSWORD_RESET_TTL_MINUTES` (por defecto 30); usa el `APP_URL` existente para armar el enlace.
- **Frontend (`vet-manage-frontend`)**: `src/modules/auth/pages/login-page.tsx`, nuevas `forgot-password-page.tsx` y `reset-password-page.tsx`, `services/auth-api.ts`, `src/app/router.tsx` (rutas públicas) y sus pruebas.
- **Fuera de alcance**: recuperación por SMS o preguntas de seguridad; reenvío de credenciales temporales por el Administrador.
