## Why

La ruta `/pets` hoy muestra solo «El listado de pacientes estará disponible próximamente» y «Desde aquí se podrán consultar los pacientes registrados», mientras que la API ya cuenta con el modelo `Patient` y el registro de pacientes (HU-07). Sin una consulta buscable, los roles de Recepcionista, Gerente, Veterinario y Técnico Veterinario no pueden localizar la ficha de un paciente durante la atención, que es el objetivo de HU-12/RF-08.

## What Changes

- Exponer una consulta paginada de pacientes en el backend, reutilizando el módulo existente de pacientes y el permiso `pets:read`, sin crear nuevas entidades ni migraciones.
- Aceptar búsqueda por nombre del paciente, código `PAC-` con 4 a 6 dígitos, primer nombre del cliente asociado y prefijo de cédula del cliente, normalizando espacios, mayúsculas y tildes.
- Incluir en cada resultado código, nombre, especie, cliente asociado y estado, sin filtrar por estado (Activo, Inactivo y Dado de baja deben aparecer).
- Reemplazar el placeholder de `/pets` por una vista con buscador, tabla, estados vacíos y paginación de 20, usando los componentes y el patrón Page → Hook → Module Service → HTTP Client ya presentes en el proyecto.
- Permitir seleccionar un paciente de los resultados para abrir su ficha, sin extender este cambio a la edición, inactivación ni baja de pacientes.
- Restringir tanto la API como la vista a los roles autorizados por la matriz de permisos del Módulo 1.

## Capabilities

### New Capabilities
- `patient-query`: consulta paginada y buscable de pacientes por nombre, código, primer nombre del cliente o cédula del cliente, con control de acceso `pets:read`.
- `patient-query-ui`: vista de `/pets` que reemplaza el placeholder por buscador, tabla de resultados, estados vacíos y paginación, con selección de paciente.

### Modified Capabilities
- Ninguna. La consulta usa los modelos y contratos existentes de `patient-registration`; no cambia sus requisitos.

## Impact

- **Backend**: módulo de pacientes en `vet-manage-api/src/modules/` (rutas, DTO de consulta, servicio y repositorio), registro en `app.module.ts` si aplica, y pruebas unitarias/e2e del nuevo endpoint.
- **Frontend**: página de `/pets`, hook, service y tipos bajo `vet-manage-frontend/src/modules/pets/`, además de los componentes compartidos de tabla, búsqueda, paginación y estados vacíos.
- **Autorización**: permiso `pets:read` ya declarado en el catálogo RBAC; se reutiliza en decoradores/guards y en el renderizado condicional de la vista.
- **Datos**: sin cambios de esquema, migraciones ni seeds; se consultan las tablas existentes de pacientes, clientes, especies y razas.
- **Documentación**: la HU-12 y sus criterios en `docs/modulo-1-historial-clinico/` son la fuente de los criterios de aceptación.
