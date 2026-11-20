## 1. Modelo de datos y migración

- [x] 1.1 Agregar el modelo `Client` en `vet-manage-api/prisma/schema/identity.prisma` con `id`, `personId @unique`, `status`, `createdAt`, `updatedAt` y la relación inversa `Person.client Client?`
- [x] 1.2 Crear la migración `add_client_model` con `CREATE TABLE clients`, índice en `status` y backfill desde personas con rol `client` activo usando `ON CONFLICT (person_id) DO NOTHING`
- [x] 1.3 Ejecutar `npx prisma format`, `npx prisma migrate deploy` y `npx prisma generate` en `vet-manage-api/` y verificar que el cliente Prisma expone `client` y `person.client`

## 2. Módulo de consulta de clientes

- [x] 2.1 Crear la estructura `vet-manage-api/src/modules/clients/{dtos,repositories,services,routes}` y `clients.module.ts`, importando `PrismaModule` e `IdentityModule`
- [x] 2.2 Crear `ListClientsQueryDto` con validación para `page` (default 1), `pageSize` (default 20, máximo 100), `search` y `status` (`ACTIVE`, `INACTIVE`, `DEACTIVATED`)
- [x] 2.3 Crear `ClientResponseDto` con `id`, `personId`, `identification`, `firstName`, `lastName`, `email`, `phone`, `address`, `status`, `roles` y `createdAt`
- [x] 2.4 Implementar `ClientsRepository` con `findMany`/`count` filtrando por rol `client` activo, `search` insensible a mayúsculas sobre `identification`, `firstName` y `lastName`, filtro `status`, orden por `lastName`/`firstName` y `skip`/`take`
- [x] 2.5 Implementar `ClientsService` para mapear entities a `ClientResponseDto` y devolver `{ items, page, pageSize, total, totalPages }`
- [x] 2.6 Implementar `ClientsController` con `GET /clients`, `@RequirePermissions('clients:read')` y la envoltura `success(...)`
- [x] 2.7 Registrar `ClientsModule` en `vet-manage-api/src/app.module.ts` y verificar que la ruta responda bajo `/api/v1/clients`

## 3. Coherencia con el registro de clientes

- [x] 3.1 Ajustar `ClientRegistrationService` para crear el `Client` y asignar el rol `client` de categoría `CLIENT` en la misma transacción del registro
- [x] 3.2 Actualizar `client-registration.service.spec.ts` y los mocks para cubrir la creación del `Client` y la asignación del rol `client`

## 4. Pruebas unitarias

- [x] 4.1 Probar `ClientsRepository`/`ClientsService` con búsqueda por cédula, nombre y apellido insensible a mayúsculas
- [x] 4.2 Probar filtro por `status`, combinación con `search` y paginación con metadatos `total`/`totalPages`
- [x] 4.3 Probar exclusión de personal y de personas sin rol `client` activo
- [x] 4.4 Probar validación de `pageSize` fuera de rango y lista vacía cuando no hay coincidencias
- [x] 4.5 Probar que `ClientsController` aplica `clients:read` y delega los parámetros de query al servicio

## 5. Verificación final

- [x] 5.1 Ejecutar `npm test` en `vet-manage-api/` y corregir regresiones
- [x] 5.2 Ejecutar `npm run lint` en `vet-manage-api/` y corregir hallazgos
- [x] 5.3 Ejecutar `npm run build` en `vet-manage-api/` y corregir errores de compilación
- [x] 5.4 Ejecutar `openspec validate add-client-model-listing --strict` y `openspec status --change add-client-model-listing`
