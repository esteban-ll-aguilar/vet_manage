## 1. Catálogo de auditoría

- [x] 1.1 Agregar `changePassword: 'Cambiar contraseña'` a `AUDIT_ACTIONS` en `vet-manage-api/src/modules/audit/audit.catalog.ts`.

## 2. Backend – Cambio de contraseña (`identity`)

- [x] 2.1 Crear `vet-manage-api/src/modules/identity/dtos/change-password.dto.ts` con los campos `currentPassword`, `newPassword` y `confirmPassword`.
- [x] 2.2 Crear `vet-manage-api/src/modules/identity/services/change-password.service.ts` con:
  - verificación de contraseña actual (`"La contraseña actual no es correcta"`),
  - validación de confirmación (`"Las contraseñas no coinciden"`),
  - validación de política (`>= 8` caracteres, mayúscula, minúscula, número: `"La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número"`),
  - validación de diferencia respecto a la actual (`"La nueva contraseña debe ser diferente a la actual"`),
  - actualización atómica de `User.password` y `mustChangePassword = false` + registro en `AuditService.record` (`Cambiar contraseña`, `Usuarios`, sin exponer contraseñas).
- [x] 2.3 Registrar `ChangePasswordService` en `vet-manage-api/src/modules/identity/identity.module.ts` y exponer `POST /auth/change-password` (`@HttpCode(200)`, `@Authenticated()`) en `vet-manage-api/src/modules/identity/auth.controller.ts`.
- [x] 2.4 Crear pruebas unitarias en `vet-manage-api/src/modules/identity/services/change-password.service.spec.ts` cubriendo los escenarios 1 a 5 de HU-59, limpieza de `mustChangePassword` y auditoría atómica sin contraseñas.

## 3. Frontend – Pantalla y flujo obligatorio de cambio de contraseña

- [x] 3.1 Agregar `changePassword` en `vet-manage-frontend/src/modules/auth/services/auth-api.ts` y `clearMustChangePassword()` en `auth-context.ts` / `auth-provider.tsx`.
- [x] 3.2 Crear `vet-manage-frontend/src/modules/auth/pages/change-password-page.tsx` y `change-password-page.css` con formulario elegante (mostrar/ocultar contraseña, indicadores de requisitos, validaciones de HU-59, aviso en primer ingreso obligatorio y mensaje de éxito/error).
- [x] 3.3 Actualizar `vet-manage-frontend/src/modules/auth/components/require-auth.tsx`, `pages/login-page.tsx`, `common/layouts/user-menu.tsx` y `app/router.tsx` para:
  - redirigir a `/change-password` al iniciar sesión con `mustChangePassword === true`,
  - impedir navegar a otras pantallas mientras `mustChangePassword === true`,
  - ofrecer el acceso **Cambiar contraseña** en el menú de usuario.
- [x] 3.4 Crear pruebas de frontend en `vet-manage-frontend/src/modules/auth/pages/change-password-page.test.tsx` cubriendo cambio exitoso, validaciones cliente/servidor y bloqueo/redirección de primer ingreso obligatorio (Escenarios 6 y 7).

## 4. Verificación final

- [x] 4.1 Ejecutar pruebas, lint y compilación de backend y frontend en Docker (`api` y `frontend`).
