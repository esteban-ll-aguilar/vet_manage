## 1. Backend — DTO y repositorio de consulta

- [x] 1.1 Escribir pruebas unitarias rojas en `vet-manage-api/src/modules/identity/services/user-query.service.spec.ts` para orden por apellido, paginación de 20, búsqueda por cédula/nombre, filtros por rol y estado y combinación de filtros.
- [x] 1.2 Crear `QueryUsersDto` en `vet-manage-api/src/modules/identity/dtos/query-users.dto.ts` con `q`, `role`, `status`, `page` (>= 1, default 1) y `pageSize` opcional cuyo único valor permitido sea 20, usando `class-validator` y `class-transformer`.
- [x] 1.3 Crear `UserQueryRepository` en `vet-manage-api/src/modules/identity/repositories/user-query.repository.ts` con `findMany` y `count` sobre el mismo `where`, `include` de `person` y `userRoles.role`, proyección explícita de campos y `orderBy` por apellido y nombre.
- [x] 1.4 Implementar `UserQueryService.list()` que devuelva `{ items, total, page, pageSize }` y hacer pasar las pruebas de 1.1.

## 2. Backend — endpoint y control de acceso

- [x] 2.1 Agregar `GET /users` en `vet-manage-api/src/modules/identity/users.controller.ts` con `@RequirePermissions('users:read')` y la respuesta `success(...)` del envelope estándar.
- [x] 2.2 Registrar `UserQueryService` y `UserQueryRepository` como providers en `vet-manage-api/src/modules/identity/identity.module.ts`.
- [x] 2.3 Crear `vet-manage-api/test/identity/user-query.e2e-spec.ts` con transacción revertida (`inRollback`) que cubra: lista inicial ordenada y paginada, búsqueda por cédula, búsqueda parcial, filtro por rol con varios roles, filtro por estado, filtros combinados, sin resultados, 401, 403 y 400 por parámetros inválidos.
- [x] 2.4 Verificar que las pruebas unitarias y e2e del backend pasan con `npm test` y `npm run test:e2e` en `vet-manage-api`.

## 3. Frontend — tipos y servicio API

- [x] 3.1 Ampliar `vet-manage-frontend/src/modules/users/types.ts` con `UserListItem`, `UserQuery` y `UserPage`, incluyendo los estados `ACTIVE`, `INACTIVE` y `DEACTIVATED`.
- [x] 3.2 Agregar `usersApi.list(query)` en `vet-manage-frontend/src/modules/users/services/users-api.ts` construyendo la cadena de consulta con `URLSearchParams` y omitiendo parámetros vacíos.
- [x] 3.3 Escribir una prueba unitaria del servicio que verifique los parámetros enviados para búsqueda, filtros y paginación.

## 4. Frontend — pantalla de consulta

- [x] 4.1 Reemplazar el placeholder de `vet-manage-frontend/src/modules/users/pages/users-page.tsx` por la tabla con columnas cédula, nombre, correo, roles y estado y los controles de paginación de 20 filas.
- [x] 4.2 Agregar el buscador y los selectores de rol (desde `assignableRoles()`) y estado, recargando la lista con los filtros combinados y reiniciando la página a 1 al cambiarlos.
- [x] 4.3 Mostrar "No se encontraron usuarios" cuando `items` esté vacío, estados de carga/error y las etiquetas Activo, Inactivo y De baja.
- [x] 4.4 Crear `vet-manage-frontend/src/modules/users/pages/users-page.test.tsx` con Testing Library para lista inicial, búsqueda, filtros combinados, paginación y mensaje sin resultados.

## 5. Verificación integral y cierre

- [x] 5.1 Ejecutar `npm run build`, `npm test` y `npm run lint` en `vet-manage-api` y en `vet-manage-frontend`, y `make test`, `make lint` y `make build` desde la raíz.
- [x] 5.2 Probar los 8 criterios de aceptación de HU-52 en la aplicación con el seed demo (búsqueda por cédula y nombre, filtros, combinación, sin resultados y acceso denegado a un Cajero).
- [x] 5.3 Registrar en `.work-log.md` la fecha, lo implementado y cómo se verificó, dejando el change listo para `/opsx:verify`.
