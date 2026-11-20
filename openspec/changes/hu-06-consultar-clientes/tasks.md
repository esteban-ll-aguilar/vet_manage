## 1. Backend: precisión de la búsqueda de clientes

- [x] 1.1 Añadir casos de prueba fallidos en `src/modules/clients/dtos/list-clients-query.dto.spec.ts` para `search` de 1 carácter (400 con «Ingrese al menos 2 caracteres para buscar por nombre o los 10 dígitos de la cédula»), 10 dígitos y 2 caracteres; verificar con `npm test -- list-clients-query.dto`
- [x] 1.2 Implementar la validación de longitud de `search` en `ListClientsQueryDto` con `@MinLength(2)` condicional (no aplica a cédulas de 10 dígitos) y mensaje en español; verificar con la prueba de 1.1
- [x] 1.3 Añadir casos fallidos en `src/modules/clients/repositories/clients.repository.spec.ts` que comprueben `equals` para cédula de 10 dígitos, `OR` de `contains` con variantes de acentos para nombres y ausencia de filtro de búsqueda cuando `search` está vacío
- [x] 1.4 Implementar en `ClientsRepository` la normalización de `search`, la generación acotada de variantes `a/á`, `e/é`, `i/í`, `o/ó`, `u/ú/ü`, `n/ñ` y el `where` resultante, conservando `status`, paginación y orden; verificar con la prueba de 1.3
- [x] 1.5 Añadir un caso de regresión que compruebe que `searchActiveClients` de `pet.service.ts` sigue recibiendo `{ items, total, page, pageSize, totalPages }` con `status=ACTIVE`, `search` y `pageSize`; verificar con `npm test -- pet.service`

## 2. Backend: mascotas vinculadas al cliente

- [x] 2.1 Añadir un caso de prueba fallido en `src/modules/clients/repositories/clients.repository.spec.ts` para `findPetsByClientId` con `include` de `species` y `breed`, orden por nombre y reutilización de `findById` para cliente inexistente
- [x] 2.2 Implementar `findPetsByClientId` en `ClientsRepository` usando Prisma, devolviendo `[]` cuando no hay mascotas y `null` cuando el cliente no existe
- [x] 2.3 Añadir casos fallidos en `src/modules/clients/services/clients.service.spec.ts` para el mapeo de mascotas (`id`, `code`, `name`, `species`, `breed`, `status`) y el error 404 «Cliente no encontrado»
- [x] 2.4 Implementar `listPets(clientId)` en `ClientsService` con el mapeo y el error de dominio correspondiente; verificar con la prueba de 2.3
- [x] 2.5 Exponer `GET /clients/:clientId/pets` en `ClientsController` con `ParseUUIDPipe`, `@RequirePermissions('pets:read')` y `success(...)`; verificar con `src/modules/clients/routes/clients.controller.spec.ts` (metadata de permiso y envelope)

## 3. Backend: pruebas end-to-end

- [x] 3.1 Crear `test/clients/client-query.e2e-spec.ts` con `inRollback` cubriendo cédula exacta, coincidencia por nombre con y sin tildes, mínimo de 2 caracteres, paginación, filtro `status`, 401 y 403
- [x] 3.2 Ampliar el e2e anterior con los casos de `GET /clients/:clientId/pets`: mascotas ordenadas, lista vacía, UUID inválido (400), cliente inexistente (404) y 403 sin `pets:read`
- [x] 3.3 Ejecutar `npm run test:e2e -- client-query` en `vet-manage-api/` y comprobar que todas las escenas de `specs/client-query/spec.md` están cubiertas

## 4. Frontend: tipos y cliente API

- [x] 4.1 Añadir `ClientQuery`, `ClientPage`, `ClientListItem` y `ClientPet` a `src/modules/clients/types.ts`
- [x] 4.2 Añadir `clientsApi.list(query)` y `clientsApi.pets(clientId)` a `src/modules/clients/services/clients-api.ts` construyendo la query con `URLSearchParams`, omitiendo valores vacíos y preservando `search`, `status`, `page` y `pageSize`
- [x] 4.3 Crear `src/modules/clients/services/clients-api.test.ts` verificando las URLs exactas (`/clients?search=...&status=...&page=...` y `/clients/<uuid>/pets`) y el desenvelope de `data`; ejecutar `npm test -- clients-api`

## 5. Frontend: pantalla de consulta de clientes

- [x] 5.1 Sustituir el placeholder en `src/modules/clients/pages/clients-page.tsx` por la tabla, el buscador con botón «Buscar» y «Limpiar búsqueda», el filtro de estado y la paginación, manteniendo el botón «Nuevo cliente»
- [x] 5.2 Implementar el estado local (`search`, `query`, `result`, `loading`, `error`, `validationError`, `expandedClient`, `petsByClient`) y el `useEffect` con flag `cancelled` siguiendo el patrón de `users-page.tsx`
- [x] 5.3 Implementar la validación de al menos 2 caracteres o 10 dígitos antes de enviar la búsqueda, mostrando el mensaje exacto sin realizar la petición
- [x] 5.4 Implementar la fila expandible que carga y muestra las mascotas del cliente, con los estados «Sin mascotas vinculadas», cargando y error en línea
- [x] 5.5 Implementar el estado vacío con «No se encontraron clientes registrados con el criterio ingresado» y el enlace «Registrar nuevo cliente» condicionado a `clients:create`
- [x] 5.6 Añadir los estilos de tabla, filtros, badges, fila expandible y paginación en `src/modules/clients/pages/clients-page.css`, reutilizando las clases de `/users`
- [x] 5.7 Crear `src/modules/clients/pages/clients-page.test.tsx` con Testing Library cubriendo vista inicial, búsqueda por cédula y nombre, validación, paginación, mascotas, estado vacío y permisos; ejecutar `npm test -- clients-page`

## 6. Verificación y cierre

- [x] 6.1 Ejecutar `npm test` en `vet-manage-api/` y en `vet-manage-frontend/`; todas las suites pasan
- [x] 6.2 Ejecutar `make lint` y `make build`; sin errores de oxlint ni de TypeScript
- [x] 6.3 Verificar manualmente con `make up` que `/clients` consulta clientes, muestra sus mascotas y ofrece «Registrar nuevo cliente» cuando no hay resultados
- [x] 6.4 Ejecutar `openspec validate hu-06-consultar-clientes --strict` y `openspec status --change hu-06-consultar-clientes`; ambos sin errores
- [x] 6.5 Registrar la verificación en `.work-log.md` siguiendo el formato usado por HU-52
