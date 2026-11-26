## Why

HU-06 (RF-06) permite a Recepcionista, Gerente y Veterinario localizar clientes por cédula o nombre para seleccionar sus mascotas en recepción, agendamiento y consulta. Hoy `GET /api/v1/clients` ya lista clientes con búsqueda parcial, filtro de estado y paginación, pero `/clients` sigue mostrando un placeholder y la búsqueda no cumple los criterios de la historia: coincidencia exacta de cédula, mínimo 2 caracteres, insensibilidad a tildes, visualización de mascotas vinculadas y mensaje de "sin resultados" con opción de registro.

## What Changes

- Reemplazar el placeholder de `/clients` por una pantalla de consulta con buscador, tabla de resultados y paginación, reutilizando el patrón de `/users`.
- Precisar la semántica de búsqueda de `GET /api/v1/clients`: 10 dígitos → coincidencia exacta de cédula; 2 o más caracteres → coincidencia parcial de primer nombre o primer apellido; sin distinguir mayúsculas ni tildes; respuesta máxima de 3 segundos.
- Exponer las mascotas vinculadas a un cliente para poder seleccionarlas desde el resultado de la búsqueda.
- Mostrar el mensaje exacto «No se encontraron clientes registrados con el criterio ingresado» y la opción «Registrar nuevo cliente» cuando no haya coincidencias.
- Ajustar los mensajes de validación de búsqueda para que el frontend pueda explicar por qué no se ejecuta una consulta con menos de 2 caracteres.
- No crear modelos Prisma ni roles/permisos nuevos: se reutilizan `clients:read`, `pets:read` y `clients:create` ya existentes.

## Capabilities

### New Capabilities

- `client-query`: contrato backend de consulta de clientes — búsqueda por cédula exacta o nombre/apellido parcial (≥2 caracteres, sin mayúsculas ni tildes), paginación, control de acceso y consulta de las mascotas vinculadas a un cliente.
- `client-query-ui`: pantalla `/clients` de consulta de clientes con buscador, resultados, mascotas vinculadas, estado vacío con acceso a «Registrar nuevo cliente» y paginación.

### Modified Capabilities

- (ninguna: la semántica actual de `GET /clients` solo está descrita en el cambio aún no archivado `add-client-model-listing`, no en `openspec/specs/`)

## Impact

- **Backend**: `src/modules/clients/` (DTO de consulta, repositorio, servicio y controlador) para ajustar la búsqueda y agregar la consulta de mascotas; se conserva el envelope `{ items, total, page, pageSize, totalPages }` y los parámetros `page`, `pageSize`, `search`, `status` que ya consume `pet.service.ts`.
- **Frontend**: `src/modules/clients/` (`types.ts`, `services/clients-api.ts`, `pages/clients-page.tsx`, CSS y pruebas) más el botón «Registrar nuevo cliente» hacia `/clients/new`.
- **API**: `GET /api/v1/clients` (comportamiento de búsqueda) y la nueva ruta de mascotas de un cliente; sin cambios en `POST /api/v1/clients`.
- **Permisos**: sin cambios en el catálogo; `clients:read` para la pantalla, `pets:read` para las mascotas y `clients:create` para el acceso al registro.
- **Datos**: sin migraciones ni nuevos modelos; se leen `Client`, `Person` y `Pet` existentes.
- **Pruebas**: unitarias de DTO/servicio/repositorio/controlador y e2e en backend; de servicio API y de página con Testing Library en frontend.
