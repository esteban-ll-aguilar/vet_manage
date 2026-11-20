## Context

`ClientsModule` ya expone `GET /api/v1/clients` con `clients:read`, búsqueda parcial por cédula/nombre/apellido, filtro `status` y paginación, y es consumido por `pet.service.ts` (`searchActiveClients`). El frontend `/clients`, en cambio, todavía renderiza un placeholder y no consume ese endpoint. HU-06 exige precisión adicional: cédula exacta, coincidencia parcial de nombre/apellido con al menos 2 caracteres, insensibilidad a mayúsculas y tildes, visualización de las mascotas vinculadas, respuesta en ≤3 s y un mensaje de "sin resultados" con opción de registro. No hay endpoint de listado de mascotas; `Pet` ya tiene relación con `Client` y con `Species`/`Breed`. Los roles Recepcionista, Gerente, Veterinario y Técnico tienen `clients:read` y `pets:read`, por lo que no se requieren cambios de RBAC.

Restricciones: monolito modular, Prisma 7 + PostgreSQL, TypeScript ESM con extensiones `.js`, sin nuevos modelos de negocio ni carpetas `use-cases`.

## Goals / Non-Goals

**Goals:**

- Cumplir los tres escenarios de HU-06/RF-06 para Recepcionista, Gerente y Veterinario.
- Hacer que `/clients` consuma `GET /clients` y permita explorar las mascotas de cada resultado.
- Mantener la compatibilidad del endpoint con los consumidores existentes (`pet.service.ts`).
- Cubrir los criterios con pruebas unitarias y e2e, sin migraciones.

**Non-Goals:**

- Registrar, editar, activar o inactivar clientes (HU-01, HU-03, HU-04, HU-05) ni registrar pacientes (HU-07).
- Crear modelos Prisma, migraciones, permisos o roles.
- Extraer componentes compartidos entre `/users` y `/clients` ni refactorizar `clients` o `pets` más allá de lo necesario.
- Medir el tiempo de respuesta con herramientas de carga; el límite de 3 s se trata como presupuesto de diseño verificado con la consulta paginada.

## Decisions

**D1 — Ajustar el controlador existente en lugar de crear un módulo nuevo.** La búsqueda vive en `src/modules/clients/` (`ListClientsQueryDto`, `ClientsRepository`, `ClientsService`, `ClientsController`). Se reutiliza la estructura actual y se evita duplicar `GET /clients`. Alternativa descartada: un módulo `client-query` separado, que fragmentaría el dominio y rompería la compatibilidad con `pet.service.ts`.

**D2 — Semántica de búsqueda en el repositorio, validación en el DTO.**

- `search` se normaliza con `trim()`.
- 10 dígitos → `identification: { equals: search }`; se ignora la búsqueda por nombre para devolver únicamente la ficha coincidente (Escenario 1).
- 2–9 caracteres → coincidencia parcial sobre `firstName` y `lastName`.
- 1 carácter → HTTP 400 con «Ingrese al menos 2 caracteres para buscar por nombre o los 10 dígitos de la cédula».
- Sin `search` → listado paginado completo (comportamiento actual, necesario para `searchActiveClients`).
- Se conservan `status`, `page` (default 1) y `pageSize` (default 20, máximo 100), el orden por apellido/nombre y el envelope `{ items, total, page, pageSize, totalPages }`.

**D3 — Insensibilidad a tildes sin migración.** PostgreSQL/Prisma `mode: 'insensitive'` ignora mayúsculas pero no acentos. Se genera en el repositorio un conjunto acotado de variantes del término combinando las equivalencias `a/á`, `e/é`, `i/í`, `o/ó`, `u/ú/ü` y `n/ñ`, y se usa un `OR` de `contains` con `mode: 'insensitive'` sobre `firstName` y `lastName`. Así «jose» encuentra «José» y «jose», y «nino» encuentra «Niño». El conjunto se limita a 64 variantes para evitar consultas desproporcionadas. Alternativa descartada: `unaccent()` con `$queryRaw`, que exigiría la extensión `unaccent` y una migración, además de duplicar la lógica de paginación. Si el volumen crece, la evolución natural es una columna normalizada con índice GIN.

**D4 — Mascotas en una ruta diferida bajo el dominio de clientes.** `GET /api/v1/clients/:clientId/pets`, con `ParseUUIDPipe` y `@RequirePermissions('pets:read')`, devuelve `success([{ id, code, name, species, breed, status }])` ordenado por nombre. El repositorio reutiliza `findById` para validar existencia (404 «Cliente no encontrado») y carga `pets` con `species` y `breed` en una sola consulta. Alternativa descartada: incrustar las mascotas en cada fila del listado, que encarecería todas las búsquedas y alteraría la respuesta que ya consumen otros módulos. La carga diferida coincide con «cliente seleccionado» de los escenarios 1 y 2 y mantiene la búsqueda dentro del presupuesto de 3 s.

**D5 — Frontend espejo de `/users`.** En `src/modules/clients/` se añaden `ClientQuery`, `ClientPage`, `ClientListItem` y `ClientPet` a `types.ts`; `clientsApi.list()` y `clientsApi.pets()` construyen la query con `URLSearchParams`; `clients-page.tsx` mantiene estado local (`search`, `query`, `result`, `loading`, `error`, `expandedClient`) y un `useEffect` con flag `cancelled`, como `users-page.tsx`. El botón «Buscar» envía el término; los cambios de filtro/página vuelven a consultar. No se introduce librería de estado ni debounce: la historia describe una búsqueda explícita por botón.

**D6 — Estados vacíos y permisos.** Si `items` está vacío se muestra exactamente «No se encontraron clientes registrados con el criterio ingresado» y un enlace «Registrar nuevo cliente» a `/clients/new`, visible solo con `clients:create` (igual que el botón existente «Nuevo cliente»). `/clients` ya está protegido por `RequirePermission permission="clients:read"`; la ausencia de permiso sigue mostrando «No tiene permisos para realizar esta acción». Cada fila expandible muestra «Sin mascotas vinculadas» cuando corresponda y un error en línea si falla la carga.

**D7 — Sin cambios de infraestructura.** No hay puertos, variables de entorno ni servicios nuevos. Se reutilizan API `http://localhost:3080/api/v1`, frontend `http://localhost:5174`, PostgreSQL `55432`, Redis y RabbitMQ (management `15673`). Arranque: copiar `.env.example` a `.env` y `make up`; `make logs` para diagnóstico; verificación con `make test`, `make lint` y `make build`.

## Risks / Trade-offs

- [Las variantes de acentos no cubren todos los caracteres Unicode] → Limitado al alfabeto español del dominio; el término original siempre se incluye y el comportamiento queda documentado en pruebas.
- [El `OR` de `contains` no usa índice y puede acercarse a 3 s con muchos clientes] → La paginación limita `take` a ≤100 y el filtro de rol activo es indexable; se añade una prueba e2e que verifica la forma de la consulta y se deja documentada la opción de índice GIN como evolución.
- [Cambiar la búsqueda de `contains` a `equals` para cédulas podría romper búsquedas parciales previas] → Se conserva el comportamiento parcial para términos de 2–9 caracteres y se añade una prueba de regresión sobre `searchActiveClients`.
- [La ruta de mascotas podría colisionar con rutas estáticas de `clients`] → `assignable-roles` es una ruta estática registrada primero en otro controlador; se usa el sufijo `/pets` y `ParseUUIDPipe`, con prueba e2e para UUID inválido.
- [Carga de mascotas bajo `pets:read` cuando el usuario solo tiene `clients:read`] → Todos los roles que consultan clientes ya tienen `pets:read`; se valida con una prueba 403.

## Migration Plan

Sin migraciones de base de datos ni cambios de configuración. Despliegue en dos pasos: primero el backend (búsqueda ajustada y nueva ruta), luego el frontend. La rollback consiste en revertir el commit del frontend y, si se requiere, el del backend; ninguno deja datos nuevos ni cambia el esquema. Verificación: `npm test`, `npm run test:e2e`, `npm run lint`, `npm run build` en `vet-manage-api/`; `npm test`, `npm run lint`, `npm run build` en `vet-manage-frontend/`; y `openspec validate hu-06-consultar-clientes --strict`.

## Open Questions

- ¿Debe el campo «mascotas» mostrar también el código `PAC-xxxxxx` además del nombre, o basta con nombre/especie/raza? La propuesta usa todos los campos disponibles del `Pet` existente.
- ¿Se quiere el límite de 3 s como alerta automatizada en las pruebas o solo como presupuesto de diseño? Por ahora se cubre con la consulta paginada y no se añade instrumentación.
