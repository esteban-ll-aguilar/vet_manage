## Context

HU-51 dejó `/users` con un placeholder: el módulo `identity` ya expone `POST /users` y `GET /users/assignable-roles`, el permiso `users:read` ya está en `src/config/permissions/identity.permissions.ts` y asignado al rol `administrator` en `src/config/roles.catalog.ts`, y la ruta frontend `/users` ya está protegida con `RequirePermission permission="users:read"` (`vet-manage-frontend/src/app/router.tsx:34`). Falta el endpoint de consulta y la pantalla; no hay cambios de esquema ni de permisos.

Documentación funcional de referencia: `docs/modulo-1-historial-clinico/historias-usuario/08-autenticacion-usuarios.md` (HU-52, RF-56, 8 escenarios) y `docs/modulo-1-historial-clinico/matriz-roles-permisos.md:29` (solo Administrador).

## Goals / Non-Goals

**Goals:**

- Listar usuarios ordenados por apellido en páginas de 20 con cédula, nombre, correo, roles y estado.
- Buscar por cédula exacta o nombre parcial; filtrar por rol y estado y combinar los criterios.
- Mostrar "No se encontraron usuarios" sin resultados y respetar `users:read` en API y UI.

**Non-Goals:**

- Actualizar datos, cambiar roles o estados, dar de baja o reenviar credenciales (HU-53, HU-54, HU-55, HU-58, HU-61).
- Exportación, auditoría (HU-60), paginación configurable por el cliente o nuevos permisos.
- Cambios en el esquema Prisma o nuevas migraciones.

## Decisions

- **Un endpoint de lectura en `UsersController`**: `GET /api/v1/users` con `@RequirePermissions('users:read')`. Alternativa descartada: crear un módulo `users` nuevo; se rechaza porque los modelos, guards y permisos ya viven en `identity` y el proyecto prohíbe inventar módulos de negocio (`openspec/config.yaml:7`).
- **Parámetros de consulta**: `q` (texto: cédula exacta o nombre parcial), `role` (nombre interno del rol, p. ej. `veterinarian`), `status` (`ACTIVE` | `INACTIVE` | `DEACTIVATED`), `page` (entero >= 1, default 1) y `pageSize` opcional cuyo único valor permitido es `20`. Cualquier otro valor responde 400 mediante el `ValidationPipe` global. Alternativa descartada: `pageSize` libre; se rechaza porque HU-52 fija 20 filas por página y evita consultas costosas.
- **Contrato de respuesta**: `success({ items, total, page, pageSize }, ...)` con `items: { id, identification, firstName, lastName, email, roles: { name, displayName }[], status }`. Se excluyen `password`, `failedLoginAttempts`, `isLocked` y datos de sesión. Alternativa descartada: devolver la entidad Prisma completa; filtrar en el repositorio evita exponer datos sensibles.
- **Consulta en el repositorio**: `prisma.user.findMany` + `prisma.user.count` con el mismo `where`, `include` de `person` y `userRoles.role`, `orderBy` por `person.lastName` y `person.firstName`, `skip = (page - 1) * 20` y `take = 20`. El filtro por rol usa `userRoles: { some: { role: { name: role, isActive: true } } }` y la respuesta conserva todos los roles del usuario. Alternativa descartada: filtrar en memoria; no escala y rompe la paginación.
- **Búsqueda insensible a mayúsculas**: identificación exacta con `equals` y `mode: 'insensitive'`, y coincidencia parcial con `contains` y `mode: 'insensitive'` sobre `firstName` y `lastName` (`persons` ya tiene índice por `[lastName, firstName]`, `identity.prisma:26`). No se normalizan tildes: los escenarios de HU-52 buscan "Pérez" contra "Pérez".
- **Capa frontend**: la página usa estado local para `q`, `role`, `status` y `page`, llama a `usersApi.list()` desde `services/users-api.ts` con `URLSearchParams`, y obtiene los roles para el selector de `assignableRoles()`. Alternativa descartada: un hook global; no hay patrón de hooks en el módulo y la tabla es el único consumidor.
- **Mensajes y estados**: `No se encontraron usuarios` para lista vacía; `No tiene permisos para realizar esta acción` ya lo produce `PermissionsGuard` y `RequirePermission`. Etiquetas de estado: `ACTIVE → Activo`, `INACTIVE → Inactivo`, `DEACTIVATED → De baja`.

## Risks / Trade-offs

- [La búsqueda con `contains` no usa índice y puede ser lenta con muchos usuarios] → se mantiene `pageSize = 20` y se usa el índice existente de apellido para el orden; si crece el volumen se evaluará `pg_trgm` en otro cambio.
- [Un usuario con varios roles podría mostrarse incompleto al filtrar] → el `include` devuelve todos los roles aunque el `where` use `some`.
- [Exponer campos internos del usuario] → el repositorio proyecta explícitamente solo los campos del contrato.
- [Los permisos pueden cambiar sin reiniciar] → `PermissionsGuard` ya resuelve `users:read` desde BD en cada petición, sin cambios.

## Migration Plan

Sin migración de base de datos: la tabla, el permiso `users:read` y la asignación al administrador ya existen. No hay variables de entorno ni puertos nuevos: API 3080, frontend 5174, PostgreSQL 55432, Redis 56379, RabbitMQ 55672/15673 y Mailpit 51025/58025 (`README.md:57-73`). Despliegue: `cp .env.example .env && make up` (o `make up-seed` para datos demo) y rollback revirtiendo el commit del cambio.

Verificación: `npm test`, `npm run test:e2e` y `npm run build` en `vet-manage-api`; `npm test`, `npm run build` y `npm run lint` en `vet-manage-frontend`; desde la raíz `make test`, `make lint` y `make build`.

## Open Questions

Ninguna. Los criterios de HU-52 son explícitos; si la implementación revela un desacuerdo se actualizarán los artefactos antes de continuar.
