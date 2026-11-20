## Why

El endpoint de registro de clientes (`POST /api/v1/clients`) ya existe, pero la ruta `http://localhost:5174/clients` sigue mostrando el placeholder "Módulo en preparación". Se necesita habilitar la interfaz de registro de clientes reutilizando los componentes y el diseño ya establecidos en la gestión de usuarios, para que los usuarios con el permiso adecuado puedan registrar clientes desde la UI.

## What Changes

- Reemplazar el placeholder de `/clients` por una pantalla de clientes que conserve el diseño de `/users` y reemplace el botón "Nuevo usuario" por "Nuevo cliente".
- Agregar la ruta `/clients/new` con un formulario de registro de cliente que reutilice los mismos componentes y diseño que `/users/new`.
- Mostrar en `/clients/new` la sección de ingreso de datos del cliente y una sección de roles donde el rol `client` aparezca seleccionado (no editable por el usuario).
- Cambiar la acción principal del formulario a "Guardar cliente" y enviar el registro al endpoint existente `POST /api/v1/clients`.
- Mostrar estados de carga, éxito y error alineados con el flujo de registro de usuarios, respetando los mensajes del backend cuando aplique.
- Respetar el control de acceso de UI existente: la navegación/entrada a clientes se basa en `clients:read`, mientras que el acceso al formulario de alta y el guardado requieren `clients:create`.
- Corregir dos defectos preexistentes del backend que impedían guardar/listar clientes: el DTO de `POST /clients` se importaba con `import type` (la `ValidationPipe` rechazaba todos los campos) y faltaba la migración de la columna `persons.address` declarada en el schema.

## Capabilities

### New Capabilities
- `client-registration-ui`: Interfaz de listado/salida de clientes y formulario de registro en `/clients` y `/clients/new`, reutilizando el diseño de usuarios y consumiendo `POST /api/v1/clients`.

### Modified Capabilities
- (ninguna) — No se modifican requisitos canónicos existentes en `openspec/specs/`; se reutiliza el comportamiento ya definido de autenticación, control de acceso y registro de clientes en backend.

## Impact

- **Frontend (React/Vite)**: router, páginas de clientes, formulario de registro, llamada al cliente HTTP de `POST /api/v1/clients` y pruebas de UI.
- **Reutilización de componentes**: componentes de layout, campos, botones, tarjetas/secciones y manejo de formularios usados hoy en `/users` y `/users/new`.
- **Permisos**: la UI debe considerar `clients:read` (acceso a la sección) y `clients:create` (botón "Nuevo cliente", ruta `/clients/new` y envío del formulario), coherente con `clinical.permissions.ts` y `roles.catalog.ts`.
- **Backend/API**: dos correcciones mínimas en `vet-manage-api`: import de valor del DTO en `clients.controller.ts` y nueva migración `20261119150000_add_person_address`. El contrato de la API no cambia.
- **Riesgo**: divergencia visual o de validación con `/users/new`; se mitiga reutilizando los mismos componentes y cubriendo el flujo con pruebas.
