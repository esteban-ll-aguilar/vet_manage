## Context

El backend es un monolito modular NestJS (ESM, importaciones con extensión `.js`). La persistencia es Prisma 7 sobre PostgreSQL, con esquema dividido en `vet-manage-api/prisma/schema/{base,identity,inventory}.prisma` y migraciones en `vet-manage-api/prisma/migrations/`. Los permisos se definen en `src/config/permissions/` y se aplican con `@RequirePermissions(...)`.

Hoy un "cliente" se representa como `Person` + `User` con el rol `CLIENT` del catálogo RBAC. Existen los permisos `clients:*` (incluido `clients:read`, asignado a Gerente, Veterinario, Técnico y Recepcionista) pero ningún endpoint que los consuma, y no existe una entidad `Client` en Prisma. El registro de clientes del change anterior crea `Person` + `User`, pero hoy todavía no genera un registro `Client` ni asigna el rol `client`.

Puertos y entorno (de `docker-compose.yml` / `.env`): API `3080`, PostgreSQL `55432`, Redis `56379`, RabbitMQ AMQP `55672`, frontend `5174`. Los servicios se conectan por nombre de servicio Docker (`postgres`, `redis`, `rabbitmq`) usando `DATABASE_URL`, `REDIS_URL`, `RABBITMQ_URL`. Arranque: `cp .env.example .env && make up`. Verificación: `make test`, `make lint`, `make build`.

## Goals / Non-Goals

**Goals:**
- Crear la entidad `Client` dedicada en Prisma, relacionada 1:1 con `Person`, con migración y backfill de datos existentes.
- Exponer `GET /clients` protegido con `clients:read`, listando solo personas con rol `client` activo.
- Soportar búsqueda parcial (cédula, nombre, apellido), filtro por estado y paginación.
- Definir un modelo de respuesta consistente, sin exponer contraseñas ni datos de autenticación.

**Non-Goals:**
- Modificar el frontend (se abordará en un change separado).
- Implementar CRUD completo de clientes (alta/edición/baja) más allá de lo necesario para que el listado y el registro existente sean coherentes.
- Cambiar el catálogo de permisos o roles (`clients:read` ya existe).
- Implementar relaciones con mascotas o historial clínico.

## Decisions

### D1 — Entidad `Client` dedicada 1:1 con `Person`
Se crea `model Client { id, personId @unique, status, createdAt, updatedAt }` en `identity.prisma` y la relación inversa `Person.client Client?`. Se eligió una tabla propia (no solo derivar de `User`+rol) porque el equipo lo solicitó explícitamente y porque desacopla el estado del cliente del estado de la cuenta de usuario, permitiendo evitar duplicados con `@unique(personId)`.

*Alternativa descartada:* derivar el cliente únicamente de `Person` + rol `CLIENT` (sin tabla). Más simple, pero no cumple el requisito de entidad dedicada ni deja lugar a atributos propios del cliente.

### D2 — Módulo `clients` independiente
Se crea `src/modules/clients/` con `repositories/`, `dtos/`, `services/`, `routes/` y `clients.module.ts`, siguiendo el patrón `<future-module>/` de `docs/architecture-vet-manage-2026-10-23.md` y el módulo `inventory` ya existente. El módulo importa `IdentityModule` para usar `@RequirePermissions`.

*Alternativa descartada:* agregar el listado dentro de `IdentityModule`. Mezclaría el dominio de clientes con identidad y contradiría la separación prevista en la arquitectura.

### D3 — Filtro por rol `client` activo
`GET /clients` devuelve registros de `Client` cuya `Person` tiene un `User` con al menos un `UserRole` hacia el rol `client` no vencido (`expiresAt = null` o `> now`). Esto excluye al personal aunque tenga un registro `Client`. Se usa el mismo criterio de "rol activo" que ya aplica `UserRegistrationService`.

*Alternativa descartada:* listar todas las filas de `Client` sin validar el rol. Permitiría que personal con un registro `Client` apareciera como cliente.

### D4 — Consulta paginada con búsqueda y filtro
Parámetros de query: `page` (default 1), `pageSize` (default 20, máximo 100), `search` (coincidencia parcial insensible a mayúsculas sobre `identification`, `firstName`, `lastName`) y `status` (`ACTIVE`/`INACTIVE`/`DEACTIVATED`). Se usa `skip/take` de Prisma con `count` para el total. Orden por `lastName`, `firstName` (índice existente en `persons`).

### D5 — Modelo de respuesta
Cada item expone: `id` (del Client), `personId`, `identification`, `firstName`, `lastName`, `email`, `phone`, `address`, `status`, `roles` (nombre y displayName) y `createdAt`. Nunca se expone `password`, hash ni campos de sesión. La envoltura de respuesta reutiliza `success(...)` de `common/errors/api-response.ts`.

### D6 — Coherencia con el registro existente
Para que el listado tenga datos y no pueda divergir, se ajusta el flujo de registro de clientes para que (a) cree el registro `Client` en la misma transacción y (b) asigne el rol `client` (categoría `CLIENT`) en lugar de roles del personal. Un único punto de escritura evita duplicados y mantiene la invariante "todo `Client` tiene rol `client`".

## Risks / Trade-offs

- **[R1] Divergencia entre tabla `Client` y rol `client`** → Un único punto de escritura (registro) crea ambos; el listado filtra por rol como segunda barrera; el backfill de migración alinea datos preexistentes.
- **[R2] Personas registradas antes de la migración sin fila `Client`** → La migración incluye un `INSERT ... SELECT` que crea `Client` para toda persona con rol `client` activo; `personId @unique` evita duplicados.
- **[R3] Registros huérfanos de `Client`** → `onDelete: Restrict` desde `Person`; el listado usa `inner join` implícito vía `person`.
- **[R4] Costo de la consulta con joins** → Índices existentes en `persons(last_name, first_name)`, `user_roles(role_id)`; nuevo índice en `clients(status)`; `pageSize` acotado a 100.
- **[R5] Cambio en el registro puede afectar pruebas del change anterior** → Se actualizan los mocks/especificaciones del `ClientRegistrationService` en la misma implementación; `make test` debe pasar.

## Migration Plan

1. Agregar `Client` a `prisma/schema/identity.prisma` y la relación inversa en `Person`.
2. Ejecutar `cd vet-manage-api && npx prisma migrate dev --name add_client_model` (genera SQL + aplica en local).
3. En la misma migración, backfill: `INSERT INTO clients (id, person_id, status, created_at, updated_at) SELECT gen_random_uuid(), p.id, 'ACTIVE', NOW(), NOW() FROM persons p JOIN users u ON u.person_id = p.id JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id WHERE r.name = 'client' AND (ur.expires_at IS NULL OR ur.expires_at > NOW()) ON CONFLICT (person_id) DO NOTHING;`
4. `npx prisma generate` (o `make up`, que ya ejecuta `migrate deploy` + `generate`).
5. Rollback: Eliminar el modelo del esquema y revertir la migración (DROP TABLE `clients` y la columna/relación); el registro vuelve a depender solo de `Person` + rol.

## Open Questions

- ¿Debe el campo `address` vivir en `Person` (como quedó en el change anterior) o trasladarse a `Client`? Por ahora se mantiene en `Person` para no romper el registro existente.
- ¿Se requiere un endpoint `GET /clients/:id` en este change? Se deja fuera; el alcance acordado es solo el listado.
- ¿Formato de paginación preferido por el frontend (`page/pageSize` vs `offset/limit`)? Se adopta `page/pageSize` por coherencia con HU-052; confirmar al construir la UI.
