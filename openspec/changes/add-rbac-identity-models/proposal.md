# Proposal: Identity y RBAC declarativo

## Why

Vet Manage necesita una base de identidad y autorización inspirada en `sb_auth_core_pkg`, pero adaptada a Prisma y a la arquitectura NestJS. Los roles y permisos deben vivir en el código como catálogo declarativo y sincronizarse con la base de datos al arrancar, incluyendo actualización, reactivación y desactivación lógica.

## What changes

- Añadir modelos Prisma de usuario, perfil, sesión, rol, permiso y tablas de relación.
- Añadir respuesta/envelope global de errores y filtro global de excepciones.
- Añadir catálogo declarativo de permisos y roles en archivos separados.
- Sincronizar permisos y roles declarados contra PostgreSQL durante el arranque.
- Conservar registros históricos: lo retirado del código se marca inactivo, no se elimina físicamente.
- Documentar las relaciones y el procedimiento para agregar o retirar permisos/roles.

## In scope

- Modelos y relaciones RBAC.
- Sincronización de catálogo.
- Estructura de identidad preparada para login por roles.
- Excepción global equivalente al envelope de `sb_common_pkg`.

## Out of scope

- Implementación de login, JWT, refresh tokens y guards.
- UI de administración de usuarios, roles y permisos.
- Multi-tenant completo con organizaciones/sucursales.
- Copiar lógica Java o entidades no necesarias para Vet Manage.

## Success criteria

- Prisma valida y genera el cliente con las relaciones.
- La sincronización crea, actualiza, reactiva y desactiva registros según los archivos declarativos.
- El arranque es idempotente.
- Las excepciones API tienen un formato uniforme.
- Tests cubren el plan de sincronización y los modelos no eliminan datos históricos.
