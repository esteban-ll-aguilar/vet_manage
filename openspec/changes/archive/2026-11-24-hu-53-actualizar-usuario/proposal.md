## Why

El Administrador registra al personal (HU-51) y lo consulta (HU-52), pero no puede corregir su nombre, apellido, correo o teléfono. Si un empleado cambia de correo, hoy no hay forma de que siga iniciando sesión con el nuevo. HU-53 (SP-02, issue Axlmd16/vet_manage#31) resuelve esto con el riesgo R-09: evitar correos duplicados o credenciales inconsistentes.

## What Changes

- Nuevo endpoint `GET /api/v1/users/:id` (permiso `users:read`). Devuelve los datos del usuario para el formulario: cédula, nombres, apellidos, correo, teléfono, estado y roles. El listado no incluye el teléfono.
- Nuevo endpoint `PATCH /api/v1/users/:id` (permiso `users:update`, solo el Administrador según la matriz, sección 2.1). Actualiza primer nombre, primer apellido, correo y teléfono en `Person`.
- La cédula no se puede cambiar: si llega en la petición, se ignora.
- Validación con los mensajes exactos de los criterios de aceptación:
  - `"Complete los campos obligatorios"` si falta nombre, apellido o correo; el teléfono es opcional, como en HU-51;
  - `"Formato no válido"` en el campo si el correo o el teléfono tienen mal formato, o si un nombre supera 100 caracteres;
  - `"El correo ya se encuentra registrado"` si otra persona ya usa el correo, sin distinguir mayúsculas.
- Al cambiar el correo:
  - el usuario inicia sesión con el nuevo correo, porque el inicio de sesión usa el correo de la persona;
  - el sistema envía un aviso del cambio al correo anterior. Si el envío falla, los datos se guardan igual: el mensaje sigue siendo `"Datos actualizados correctamente"` y se agrega una advertencia.
- No se puede editar un usuario dado de baja (`DEACTIVATED`): la API responde 409 y la pantalla muestra sus datos solo para consulta. Un usuario `INACTIVE` sí se puede editar.
- La auditoría registra `Actualizar` en el módulo `Usuarios`, con el valor anterior y el nuevo solo de los campos cambiados.
- Pantalla de usuarios:
  - acción «Editar» con un formulario que muestra la cédula bloqueada y los botones «Guardar» y «Cancelar»;
  - acción «Ver datos» de solo lectura para los usuarios dados de baja;
  - mensaje de éxito `"Datos actualizados correctamente"` como toast.

## Capabilities

### New Capabilities
- `user-update`: consulta del detalle de un usuario y actualización de sus datos de contacto en la API. Incluye la cédula inmutable, la validación, el correo único, el aviso al correo anterior, el rechazo de usuarios dados de baja, la auditoría y los permisos `users:read` y `users:update`.
- `user-update-ui`: edición de usuarios desde la pantalla de usuarios, con la cédula bloqueada, la validación de campos, la vista de solo lectura para usuarios dados de baja y el toast de éxito.

### Modified Capabilities
- `user-status-management-ui` (HU-55): los mensajes de éxito y de error de activar e inactivar pasan de un aviso sobre el listado a toasts, para que todas las acciones de la pantalla de usuarios avisen igual. No cambia el flujo ni los permisos.

## Impact

- **Backend** (`vet-manage-api/src/modules/identity/`):
  - nuevos DTO y servicios `user-detail.service.ts` y `update-user.service.ts`;
  - plantilla del aviso de cambio de correo en el módulo `identity`, que reutiliza `email-layout.ts` sin modificarlo;
  - rutas nuevas en `users.controller.ts`;
  - pruebas unitarias y e2e.
- **Permisos**: no cambian. `users:read` y `users:update` ya son del Administrador en `roles.catalog.ts`.
- **Base de datos**: sin migraciones. Los datos de contacto viven en `Person`, que comparten `User` y `Client` (diagrama de clases).
- **Relación con HU-02**: si el usuario también es cliente, su correo como cliente cambia con él, porque la persona es una sola. Esto coincide con HU-02, donde solo el Administrador puede cambiar el correo de quien también es personal.
- **Frontend** (`vet-manage-frontend/src/modules/users/`): modal de edición y de consulta, cliente de API, reglas en `form-rules.ts` y pruebas.
- **Otros formularios**: el teléfono solo admite números en el registro de usuarios (HU-51, conserva el `+` inicial) y en el registro y la edición de clientes (HU-01 y HU-02, `clients/form-rules.ts`). No cambian las reglas de validación ni los mensajes de esas HU.
