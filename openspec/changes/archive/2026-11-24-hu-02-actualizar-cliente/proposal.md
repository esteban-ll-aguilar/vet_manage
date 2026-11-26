## Why

Hoy un cliente solo se puede registrar (HU-01), consultar (HU-06) e inactivar (HU-04): si cambia de teléfono, correo o dirección, nadie puede corregirlo y la clínica trabaja con datos de contacto desactualizados. HU-02 (SP-02, prioridad alta) permite que la Recepcionista, el Gerente o el Veterinario actualicen esos datos sin tocar la cédula, que identifica al cliente.

## What Changes

- Nuevo endpoint `PATCH /api/v1/clients/:clientId` protegido con `clients:update`, que actualiza primer nombre, primer apellido, correo, teléfono y dirección del cliente, con las mismas reglas de validación y los mismos mensajes que el registro (HU-01).
- La cédula no se puede cambiar: el endpoint no la acepta como dato editable.
- El correo es también el correo con el que la persona inicia sesión. Si la persona tiene un rol del personal (no solo el de cliente), el correo no se puede cambiar desde clientes; los demás campos sí.
- No se actualiza un cliente dado de baja (`DEACTIVATED`); un cliente inactivo sí se puede actualizar.
- Cada actualización queda en la auditoría con el valor anterior y el nuevo de los campos cambiados (HT-04).
- Frontend: acción «Editar» en el listado de clientes (solo con `clients:update`) que abre un formulario con los datos actuales, la cédula bloqueada, el botón «Guardar Cambios» y «Cancelar». Resalta los campos vacíos o inválidos y muestra «Datos actualizados correctamente» al guardar.

## Capabilities

### New Capabilities
- `client-update`: actualización de los datos de contacto de un cliente en la API (`PATCH /api/v1/clients/:clientId`), con validación, cédula inmutable, protección del correo del personal, rechazo de clientes dados de baja, auditoría y permiso `clients:update`.
- `client-update-ui`: formulario de edición de cliente desde el listado de clientes, con la cédula en solo lectura, validación de campos obligatorios y un toast de éxito.

### Modified Capabilities
- `client-inactivation-ui` (HU-04): los mensajes de éxito y de error de la inactivación pasan de un aviso sobre el listado a toasts, para que todas las acciones de la pantalla de clientes avisen igual. No cambia el flujo ni los permisos.

## Impact

- **Backend** (`vet-manage-api/src/modules/clients/`): nuevo DTO, servicio `update-client.service.ts`, ruta en `clients.controller.ts` y pruebas unitarias y e2e en `test/clients/`. Usa `AuditService` y los mensajes de `CLIENT_MESSAGES` de HU-01.
- **Permisos**: no cambian. La matriz (sección 2.2) da «Actualizar cliente» a Gerente, Veterinario y Recepcionista, que ya tienen `clients:update` en `roles.catalog.ts`.
- **Base de datos**: sin migraciones; los datos de contacto ya viven en `Person` y el estado en `Client`, como en el diagrama de clases (`Cliente` «esUna» `Persona`; una persona se guarda una sola vez aunque sea cliente y empleado).
- **Frontend** (`vet-manage-frontend/src/modules/clients/`): nuevo modal de edición, cliente de API `update`, reglas de validación en `form-rules.ts` y pruebas.
- **Relación con HU-53**: HU-53 (Actualizar datos de usuario) también edita `Person`; las reglas de correo y teléfono de este cambio deben servirle.
