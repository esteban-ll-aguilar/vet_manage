## Why

El sistema registra clientes reutilizando `Person` + `User` con el rol `CLIENT`, pero no existe una entidad `Client` dedicada ni una forma de consultarlos. Los permisos `clients:read` ya están definidos y asignados a varios roles del personal, pero hoy no hay endpoint que los use. Se necesita un modelo de clientes y un endpoint de listado para que esos permisos sean operativos y para sentar la base de las relaciones clínica (mascotas, historial) previstas en la arquitectura.

## What Changes

- Crear una entidad Prisma `Client` dedicada, relacionada 1:1 con `Person`, con su migración correspondiente.
- Exponer `GET /clients`, protegido con `clients:read`, que liste únicamente las personas cuya cuenta tenga el rol `client` activo (excluyendo al personal).
- Soportar búsqueda parcial por cédula, nombre y apellido; filtro por estado; y paginación.
- Definir un modelo de respuesta de cliente con los campos de `Person` y el estado del cliente.
- Agregar pruebas unitarias del servicio de listado y del modelo de respuesta.

## Capabilities

### New Capabilities
- `client-catalog`: Modelo de datos de clientes (entidad `Client` ligada a `Person`) y consulta paginada de clientes con búsqueda y filtros.

### Modified Capabilities
- (ninguna) — No cambian los requisitos de capacidades existentes; el permiso `clients:read` ya existe en el catálogo.

## Impact

- **Base de datos**: nuevo modelo `Client` en `prisma/schema/identity.prisma`, relación inversa en `Person` y nueva migración en `prisma/migrations/`.
- **Backend (NestJS)**: nuevo módulo/servicio/controlador de clientes en `vet-manage-api/src/modules/` siguiendo el patrón de `inventory` (repositories/dtos/services/routes).
- **API**: nuevo endpoint `GET /clients` bajo el prefijo `/api/v1`, protegido con `RequirePermissions('clients:read')`.
- **Permisos**: reutiliza `clients:read` existente; no requiere cambios en `roles.catalog.ts` ni en `permissions.catalog.ts`.
- **Frontend**: sin cambios en este change; el consumo de la interfaz se abordará por separado.
