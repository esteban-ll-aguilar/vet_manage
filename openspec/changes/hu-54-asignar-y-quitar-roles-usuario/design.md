## Context

HU-52 entrega la consulta de usuarios (`GET /api/v1/users`, permiso `users:read`) dentro del módulo `identity`. El modelo RBAC ya existe (`User`, `Role`, `UserRole` con `assignedById`/`expiresAt`, `RolePermission`, `Permission`) y el catálogo define el permiso `users:assign-roles`, asignado solo al rol `administrator` (`src/config/roles.catalog.ts`, `src/config/permissions/identity.permissions.ts`). `AccessService` resuelve roles y permisos efectivos en cada petición a partir de asignaciones activas y vigentes, y los guards (`JwtAuthGuard`, `PermissionsGuard`) reutilizan ese cálculo.

HU-54 (RF-58) requiere que el Administrador asigne y quite roles al personal con validaciones de negocio: no dejar al usuario sin rol, no quitar el último Administrador activo, no ofrecer roles ya asignados y bloquear cambios en usuarios dados de baja.

## Goals / Non-Goals

**Goals:**
- Exponer en `modules/identity` la consulta y actualización de roles de un usuario, protegidas por `users:assign-roles`, con respuestas en el envelope estándar.
- Aplicar de forma atómica las reglas de HU-54 y registrar `assignedById` en las asignaciones creadas o reactivadas.
- Proveer una interfaz en `/users` para gestionar roles (actuales y disponibles), mostrando los mensajes definidos por HU-54 y denegando acceso sin permiso.
- Mantener cambios de acceso efectivos para las siguientes peticiones/inicios de sesión mediante la resolución dinámica existente.

**Non-Goals:**
- Cambios de esquema Prisma, migraciones, nuevos permisos o sincronización distinta del RBAC actual.
- Edición de datos personales, activación/inactivación/baja, gestión de permisos por rol o auditoría (HU-53, HU-55, HU-56, HU-60, HU-61).
- Asignación de roles a entidades fuera del flujo de usuarios del personal ya soportado.

## Decisions

- **Ubicación y reutilización (identidad existente)**: implementar controlador/servicio/repositorio (o extensión de los existentes) dentro de `vet-manage-api/src/modules/identity`, reutilizando `@RequirePermissions`, `ApiException`, `success(...)`, `PrismaService` y `AccessService`. *Alternativa*: módulo nuevo de administración de usuarios; se descarta porque los modelos, guards y permisos ya viven en `identity` y el proyecto evita inventar módulos de negocio.
- **Contrato de API orientado al estado final**:
  - `GET /api/v1/users/:id/role-assignment` devuelve `{ user: { id, status, fullName? }, currentRoles, availableRoles }`, donde `currentRoles` son las asignaciones vigentes (rol activo y no expirado) y `availableRoles` son los roles `STAFF` activos no presentes en `currentRoles`. Responde 404 si el usuario no existe.
  - `PUT /api/v1/users/:id/role-assignment` recibe `{ roles: string[] }` (nombres de rol, conjunto final) y devuelve los roles vigentes resultantes. *Alternativa*: endpoints separados para agregar/quitar; se descarta porque una operación atómica simplifica validar “al menos un rol”, el cambio de función y la verificación del último Administrador.
- **Validaciones y transacción**: normalizar `roles` (trim, únicos, no vacíos), rechazar lista final vacía con 400 `"El usuario debe tener al menos un rol"`, rechazar si el usuario objetivo está `DEACTIVATED` con 400 `"No se pueden modificar los roles de un usuario dado de baja"`, y rechazar roles no válidos/no asignables (no `STAFF` activo). El servicio ejecuta en `prisma.$transaction`: calcula diff, crea `UserRole` faltantes o reactiva expirados (`expiresAt = null`, `assignedById = actorId`), elimina asignaciones de roles quitados y, si el conjunto final no incluye `administrator` estando antes presente, verifica que exista otro usuario `ACTIVE` con asignación vigente al rol `administrator`; de lo contrario 400 `"Debe existir al menos un Administrador activo"`. *Alternativa*: validación fuera de transacción; se descarta por condiciones de carrera sobre el último Administrador.
- **Efecto inmediato**: no se invalidan tokens de forma especial; `AccessService.getPermissionKeys/getActiveRoles` consulta el estado vigente en BD, por lo que los permisos/roles se reflejan en peticiones posteriores y en el siguiente inicio de sesión, cumpliendo HU-54. *Alternativa*: revocar sesiones al cambiar roles; se descarta como fuera de alcance (la inactivación de sesión corresponde a HU-55).
- **Frontend**: agregar en `modules/users` tipos y métodos en `users-api.ts` para consultar/guardar la asignación y una vista de gestión (ruta `/users/:id/roles` o acción equivalente desde `/users`) protegida con `RequirePermission permission="users:assign-roles"`. La UI muestra roles actuales, permite seleccionar solo roles disponibles, confirma guardado, y presenta los mensajes de error/success del backend; el acceso directo sin permiso muestra `"No tiene permisos para realizar esta acción"`. *Alternativa*: edición inline sin ruta propia; se acepta cualquiera que cumpla los escenarios, priorizando consistencia con los patrones existentes (`RequirePermission`, servicios en `services/`).
- **Puertos, entorno y arranque (sin cambios)**: API `3080` (`API_PREFIX=api/v1`), Frontend `5174` (`VITE_API_URL`), PostgreSQL `55432`, Redis `56379`, RabbitMQ `55672`/`15673`, Mailpit SMTP/UI `51025`/`58025`. Variables relevantes ya existentes: `DATABASE_URL`, `REDIS_URL`, `RABBITMQ_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `SESSION_EXPIRES_IN`, `RBAC_SYNC_MODE`, credenciales admin inicial y CORS/`APP_URL` (`.env.example`, `docker-compose.yml`). Arranque: `cp .env.example .env && docker compose up --build -d` (o `make up` / `make up-podman`); con datos demo `make up-seed`. La API en contenedor ejecuta `npm ci`, `prisma migrate deploy`, `prisma generate` y `start:dev`.

## Risks / Trade-offs

- [Condición de carrera al retirar el último Administrador] → comprobación y mutación dentro de una única transacción con lectura consistente de usuarios/roles activos. Mitigación adicional: cubrir con pruebas e2e el rechazo.
- [Definición de “rol asignado” con registros expirados] → tratar como actuales solo asignaciones vigentes (`expiresAt` null o futura) y rol activo; al reactivar un registro expirado se renueva en lugar de duplicar.
- [Quitar roles elimina historial de asignación] → se elimina la fila `UserRole` para reflejar “quitar rol”; no se agrega auditoría porque HU-60 está fuera de alcance. Si se requiere historial, se abordará en un cambio posterior.
- [UI puede quedar desincronizada si cambian roles en paralelo] → recargar el estado desde `GET` tras guardar y mostrar errores del backend.
- [Permiso `users:assign-roles` ya sincronizado] → sin migración/cambios de catálogo; el modo `strict` de RBAC ya lo mantiene según `roles.catalog.ts`.

## Migration Plan

1. Arranque/validación del entorno: `cp .env.example .env` (si falta) y `docker compose up --build -d`; verificar `http://localhost:3080/api/v1/health` y `/health/ready`, y frontend en `http://localhost:5174`.
2. Despliegue del cambio: sin migraciones Prisma ni nuevas variables/puertos; aplicar código y reiniciar servicios si aplica (`docker compose up --build -d` o recarga en dev).
3. Verificación: `npm test`, `npm run test:e2e`, `npm run build`, `npm run lint` en `vet-manage-api` y `vet-manage-frontend` según corresponda; desde la raíz `make test`, `make lint`, `make build`. Validar manualmente escenarios HU-54 con usuario Administrador.
4. Rollback: revertir el commit del cambio y redeplegar; no hay pasos de datos irreversibles de esquema.

## Open Questions

Ninguna. Los escenarios y mensajes de HU-54 son explícitos en `08-autenticacion-usuarios.md`; si durante la implementación surge ambigüedad se registrará y se ajustará el artefacto antes de continuar.
