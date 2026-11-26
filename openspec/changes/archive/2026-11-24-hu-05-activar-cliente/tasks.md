## 1. Servicio de cambio de estado (API)

- [x] 1.1 Agregar a `CLIENT_STATUS_MESSAGES` los mensajes `activated` («Cliente activado correctamente») y `activateDeactivated` («No se puede activar un cliente dado de baja»), y el tipo `ActivatedClientResult`.
- [x] 1.2 Implementar `ChangeClientStatusService.activate(clientId, actorId)`: 404 si no existe, 400 `CLIENT_STATUS_DEACTIVATED` si está dado de baja, éxito sin escribir si ya está activo, y `INACTIVE → ACTIVE` con auditoría (`Activar` / `Clientes`, `Inactivo → Activo`) en la misma transacción. `inactivate` debe seguir respondiendo igual.
- [x] 1.3 Pruebas unitarias en `change-client-status.service.spec.ts`: activación, idempotencia sin auditoría, 404, rechazo del dado de baja sin escribir ni auditar, contenido de la auditoría, y que las pruebas de `inactivate` sigan pasando.

## 2. Ruta (API)

- [x] 2.1 Agregar `PATCH /clients/:clientId/activate` en `clients.controller.ts`, con `@RequirePermissions('clients:activate')`, `ParseUUIDPipe` y respuesta `success({ id, status: 'ACTIVE' }, message)`.
- [x] 2.2 Pruebas del controlador en `clients.controller.spec.ts`: el permiso `clients:activate` y la delegación al servicio con el id del usuario.

## 3. Pruebas e2e

- [x] 3.1 Crear `test/clients/client-activation.e2e-spec.ts` con base de datos real:
  - activa un cliente inactivo y guarda la auditoría;
  - un cliente ya activo no genera auditoría;
  - 404, UUID inválido (400) y dado de baja (400, el cliente sigue dado de baja);
  - 401 sin sesión, y 403 para el Técnico Veterinario y el Cajero;
  - el Recepcionista, el Gerente y el Veterinario pueden activar;
  - después de activar, el cliente se puede elegir al registrar un paciente, y el Recepcionista, el Gerente y el Veterinario lo ven en `GET /clients` y `GET /clients/:id/pets` con sus datos y mascotas.

## 4. Frontend

- [x] 4.1 Agregar el tipo `ActivatedClient` y `clientsApi.activate(clientId)` (`PATCH /clients/:clientId/activate`), con su prueba en `clients-api.test.ts`.
- [x] 4.2 En `clients-page.tsx`, agregar `canActivate` (`clients:activate`) y el botón «Activar» (icono verde) solo en las filas `INACTIVE`; la columna de acciones aparece con cualquiera de los tres permisos.
- [x] 4.3 Cambiar `pendingClient` por `pendingAction = { client, targetStatus }` y adaptar el diálogo: «Activar cliente», `Inactivo → Activo` y su texto al activar; el de inactivar queda igual.
- [x] 4.4 Al confirmar la activación, actualizar la fila (o recargar si hay un filtro de estado) y mostrar el toast «Cliente activado correctamente»; si falla, mostrar un toast de error con el mensaje de la API sin cambiar la fila.
- [x] 4.5 Pruebas en `clients-page.test.tsx`:
  - «Activar» visible solo en los clientes inactivos y con el permiso;
  - ningún botón de estado en los dados de baja;
  - confirmar (llama a la API, la fila pasa a «Activo» y sale el toast);
  - cancelar (no llama a la API);
  - botones deshabilitados mientras se guarda;
  - error de la API en un toast.

## 5. Verificación

- [x] 5.1 Ejecutar las pruebas unitarias de la API y del frontend, tsc y oxlint, y la e2e de activación en el contenedor.
- [x] 5.2 Probar en el navegador: inactivar y volver a activar un cliente, cancelar, y comprobar que un cliente dado de baja no muestra «Activar».
