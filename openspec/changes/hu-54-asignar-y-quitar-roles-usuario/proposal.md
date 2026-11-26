## Why

HU-52 permite consultar usuarios, pero el Administrador no puede ajustar los roles del personal cuando cambian sus funciones. HU-54 (RF-58) requiere asignar y quitar roles con controles para proteger el acceso y la disponibilidad de al menos un Administrador activo.

## What Changes

- **Backend (`vet-manage-api/`)**:
  - Nuevos endpoints en el módulo `identity` protegidos por el permiso existente `users:assign-roles` para consultar los roles actuales de un usuario y sus roles disponibles, y para actualizar su asignación de roles.
  - Lógica de negocio para agregar y quitar roles en una operación atómica: exigir al menos un rol, impedir modificar usuarios dados de baja, impedir quitar el rol `administrator` si sería el último Administrador activo, y registrar `assignedById` en las asignaciones afectadas.
  - Pruebas unitarias y e2e que cubran los 8 escenarios de HU-54, incluyendo 401/403 y validaciones de negocio.
- **Frontend (`vet-manage-frontend/`)**:
  - Interfaz en el módulo `users` para que el Administrador gestione los roles de un usuario desde la consulta de usuarios, mostrando roles actuales y disponibles y guardando los cambios.
  - Extensión de tipos y `users-api.ts`, manejo de mensajes de éxito/error definidos por HU-54 y protección de acceso con `users:assign-roles`.
  - Pruebas de la interfaz y del servicio para los flujos de asignación, quitado, bloqueos y denegación de acceso.
- Sin cambios de esquema Prisma, sin migraciones, sin nuevos permisos ni catálogos RBAC y sin cubrir HU-53, HU-55, HU-56 o HU-61.

## Capabilities

### New Capabilities
- `user-role-assignment`: consulta y actualización de los roles de un usuario del personal con control de acceso `users:assign-roles` y reglas de negocio de HU-54.
- `user-role-assignment-ui`: interfaz para que el Administrador asigne y quite roles a usuarios, con opciones disponibles, validaciones visibles y manejo de acceso denegado.

### Modified Capabilities

## Impact

- **Documentación funcional**: `docs/modulo-1-historial-clinico/historias-usuario/08-autenticacion-usuarios.md` (HU-54) y `docs/modulo-1-historial-clinico/matriz-roles-permisos.md` (solo Administrador, permiso `users:assign-roles`).
- **API**: nuevas rutas bajo `/api/v1/users` en `modules/identity` (controlador, DTOs, servicio/repositorio), reutilizando guards, `AccessService` y el envelope estándar de respuesta/error.
- **Base de datos**: sin migraciones; se consultan/actualizan `users`, `roles` y `user_roles` existentes con Prisma, respetando asignaciones vigentes y estados.
- **Frontend**: `src/modules/users/` (tipos, servicio API, página/acción de gestión de roles y ruta protegida) reutilizando componentes y patrones existentes.
- **Pruebas**: unitarias y e2e en `vet-manage-api` y unitarias de UI/servicio en `vet-manage-frontend`; verificables con `npm test`, `npm run test:e2e`, `npm run build` y `npm run lint`.
