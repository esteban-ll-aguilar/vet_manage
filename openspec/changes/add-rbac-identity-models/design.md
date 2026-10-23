# Design: Identity y RBAC declarativo

## Modelo

```text
User 1──1 Profile
User 1──N UserSession
User 1──N UserRole N──1 Role
Role 1──N RolePermission N──1 Permission
```

Prisma usará UUID como clave primaria. `UserRole.organizationId` y
`Role.organizationId` quedan preparados para scope por organización cuando se
implemente multi-tenant; no se agrega todavía una entidad Organization.

## Catálogos

- `src/config/permissions.catalog.ts`: única fuente de permisos declarados.
- `src/config/roles.catalog.ts`: roles de sistema y sus claves de permiso.

El sincronizador compara claves estables. Para permisos: crea ausentes,
actualiza metadatos, reactiva existentes y marca inactivos los no declarados.
Para roles de sistema: hace lo mismo y reconcilia `RolePermission`, revocando
grants retirados del archivo y agregando los nuevos.

## Arranque

`IdentityModule` exporta `RbacCatalogSynchronizer`; `AppModule` ejecuta una
sincronización después de que Prisma conecte. El proceso debe ser transaccional
e idempotente.

## Errores

`ApiException` contiene `statusCode`, `errors`, `code` y `message`.
`GlobalExceptionFilter` devuelve `{ statusCode, success, message, data?, errors?, code?, traceId? }`.

## Decisiones

- No se copian entidades Enterprise/Branch del paquete Java: sus relaciones se
  incorporarán cuando exista el modelo de organización de Vet Manage.
- No se borran permisos, roles ni grants físicamente al retirarlos del código.
- El catálogo es versionable y revisable por Git.
