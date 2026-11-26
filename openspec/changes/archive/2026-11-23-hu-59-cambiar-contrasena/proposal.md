## Why

En VetManage, todo usuario con cuenta (Administrador, Gerente, Veterinario, Técnico Veterinario, Recepcionista, Cajero, Bodeguero o Cliente) debe poder cambiar su contraseña ingresando la actual y una nueva segura, y el sistema debe exigir el cambio obligatorio cuando el usuario ingresa por primera vez con una contraseña temporal generada al registrarlo (**HU-59 · Cambiar contraseña**, issue `#27`, Sprint 2).

Documentación funcional de referencia:
- `docs/modulo-1-historial-clinico/historias-usuario/08-autenticacion-usuarios.md` (HU-59, RF-63; y Escenario 9 de HU-57)
- `docs/modulo-1-historial-clinico/matriz-roles-permisos.md` (Parte 1: función general para todos los roles del sistema)

## What Changes

- Agregar `changePassword: 'Cambiar contraseña'` a `AUDIT_ACTIONS` en `vet-manage-api/src/modules/audit/audit.catalog.ts`.
- Crear `ChangePasswordDto` (`vet-manage-api/src/modules/identity/dtos/change-password.dto.ts`) y `ChangePasswordService` (`vet-manage-api/src/modules/identity/services/change-password.service.ts`) que:
  - Verifica la contraseña actual con `PasswordHasher.verify` (`400` `"La contraseña actual no es correcta"`).
  - Valida la política de nueva contraseña: al menos 8 caracteres, una mayúscula, una minúscula y un número (`400` `"La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número"`).
  - Valida que `confirmPassword` coincida con `newPassword` (`400` `"Las contraseñas no coinciden"`).
  - Valida que la nueva contraseña sea diferente a la actual (`400` `"La nueva contraseña debe ser diferente a la actual"`).
  - Actualiza `User.password` (hash con `PasswordHasher.hash`) y establece `mustChangePassword = false` dentro de una transacción Prisma, registrando la auditoría atómica (`Cambiar contraseña`, módulo `Usuarios`, sin almacenar contraseñas ni hashes).
- Exponer `POST /api/v1/auth/change-password` en `AuthController` protegido con `@Authenticated()` (accesible para todos los roles con sesión activa).
- Crear la pantalla `ChangePasswordPage` (`vet-manage-frontend/src/modules/auth/pages/change-password-page.tsx`) y su ruta `/change-password`:
  - Formulario con campos contraseña actual, nueva contraseña y confirmación, validaciones cliente/servidor con los mensajes exactos de HU-59 y botón `"Guardar"`.
  - Acceso directo desde el menú de usuario (`user-menu.tsx`) para cambios voluntarios.
  - Redirección automática y bloqueo de navegación en `RequireAuth` (`require-auth.tsx`) y `LoginPage` cuando `session.mustChangePassword === true`, impidiendo acceder a otras pantallas hasta completar el cambio obligatorio.
- Añadir pruebas unitarias de backend (`change-password.service.spec.ts`) y frontend (`change-password-page.test.tsx`, `require-auth.test.tsx`).

## Capabilities

### New Capabilities
- `password-change`: Cambio de contraseña autenticado en el backend (`POST /api/v1/auth/change-password`) con validación de contraseña actual, política de seguridad, confirmación, no repetición, limpieza de `mustChangePassword` y auditoría segura.
- `password-change-ui`: Pantalla `/change-password` con formulario y validaciones de HU-59, acceso desde el menú de usuario y guardia obligatoria en `RequireAuth` / `LoginPage` cuando `mustChangePassword` está activo.

### Modified Capabilities
- `audit-log`: Incorporar la acción `"Cambiar contraseña"` en el catálogo compartido de auditoría y registrar atómicamente cada cambio de contraseña sin exponer credenciales.

## Impact

- **Backend (`vet-manage-api`)**:
  - `src/modules/audit/audit.catalog.ts` (nueva acción `changePassword`).
  - `src/modules/identity/dtos/change-password.dto.ts` (nuevo).
  - `src/modules/identity/services/change-password.service.ts` y `change-password.service.spec.ts` (nuevos).
  - `src/modules/identity/auth.controller.ts` y `identity.module.ts`.
  - No requiere migración Prisma (`User.password` y `User.mustChangePassword` ya existen).
- **Frontend (`vet-manage-frontend`)**:
  - `src/modules/auth/services/auth-api.ts`, `auth-context.ts`, `auth-provider.tsx`, `components/require-auth.tsx`, `pages/login-page.tsx`.
  - `src/modules/auth/pages/change-password-page.tsx`, `change-password-page.css` y pruebas.
  - `src/common/layouts/user-menu.tsx` y `src/app/router.tsx`.
