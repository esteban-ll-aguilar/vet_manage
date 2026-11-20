## Why

La pantalla `/users` creada en HU-51 solo muestra un placeholder: el Administrador no puede consultar las cuentas registradas ni ubicar rápidamente una cuenta para gestionarla. HU-52 (RF-56) requiere un listado paginado con búsqueda y filtros.

## What Changes

- **Backend (`vet-manage-api/`)**:
  - Nuevo endpoint `GET /api/v1/users` protegido con el permiso existente `users:read`, que devuelve usuarios ordenados por apellido, paginados en páginas de 20 y filtrables por cédula, nombre, rol y estado.
  - Repositorio y servicio de consulta en el módulo `identity`, con DTO de validación de los parámetros de consulta y envelope estándar de respuesta.
  - Pruebas unitarias del servicio y pruebas e2e del endpoint (incluidos 401/403 y combinación de filtros).
- **Frontend (`vet-manage-frontend/`)**:
  - Reemplazar el placeholder de `pages/users-page.tsx` por el listado de usuarios con columnas cédula, nombre, correo, roles y estado.
  - Buscador y filtros por rol y estado, paginación y mensaje "No se encontraron usuarios" cuando corresponda.
  - Extensión del servicio `users-api.ts` y de los tipos para la consulta, con pruebas del componente y de las reglas de filtro.
- Sin cambios de esquema Prisma, sin catálogos RBAC nuevos y sin endpoints de edición (HU-53, HU-54, HU-55 y HU-61 quedan fuera de alcance).

## Capabilities

### New Capabilities
- `user-query`: consulta paginada y filtrable de usuarios desde la API, con control de acceso por `users:read`.
- `user-query-ui`: pantalla de consulta de usuarios con tabla, búsqueda, filtros, paginación y estados vacíos.

### Modified Capabilities

## Impact

- **Documentación funcional**: `docs/modulo-1-historial-clinico/historias-usuario/08-autenticacion-usuarios.md` (HU-52) y `matriz-roles-permisos.md` (solo Administrador).
- **API**: nueva ruta `GET /api/v1/users`; el permiso `users:read` ya existe en `identity.permissions.ts` y ya está asignado al rol `administrator` en `roles.catalog.ts`.
- **Base de datos**: sin migraciones nuevas; se consultan `persons`, `users`, `roles` y `user_roles` con el cliente Prisma actual.
- **Frontend**: `src/modules/users/` (página, servicio y tipos), ruta `/users` protegida por `RequirePermission`.
- **Pruebas**: nuevos casos unitarios y e2e en backend y unitarios en frontend; se ejecutan con `npm test`, `npm run test:e2e` y `make test`.
