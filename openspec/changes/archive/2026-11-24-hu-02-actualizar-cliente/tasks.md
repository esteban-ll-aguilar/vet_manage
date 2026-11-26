## 1. Backend: reglas y DTO (`clients`)

- [x] 1.1 Crear `vet-manage-api/src/modules/clients/services/client-contact-rules.ts` con una función pura que normalice y valide primer nombre, primer apellido, correo, teléfono y dirección. Debe lanzar `ApiException` con los mensajes de `CLIENT_MESSAGES` (HU-01), los códigos `CLIENT_MISSING_FIELDS`, `CLIENT_INVALID_EMAIL`, `CLIENT_INVALID_PHONE`, `CLIENT_INVALID_NAME` y `CLIENT_INVALID_ADDRESS`, y los campos rechazados.
- [x] 1.2 Crear `client-contact-rules.spec.ts` con los casos de la spec: obligatorios vacíos, correo `carlos@`, teléfono `0991`, nombres de más de 100 caracteres, dirección de más de 255, dirección vacía y correo en mayúsculas normalizado.
- [x] 1.3 Crear `vet-manage-api/src/modules/clients/dtos/update-client.dto.ts` con `firstName`, `lastName`, `email`, `phone` y `address` opcionales como texto, e `identification` opcional para que se ignore sin un 400 del `ValidationPipe`.

## 2. Backend: servicio y ruta

- [x] 2.1 Crear `vet-manage-api/src/modules/clients/services/update-client.service.ts` (`UpdateClientService.update(clientId, input, actorId)`), que en una sola transacción:
  - responda 404 si el cliente no existe y 409 `CLIENT_DEACTIVATED` si está dado de baja;
  - con un correo nuevo, responda 409 `CLIENT_EMAIL_LOCKED` si la persona tiene un rol vigente que no es de categoría `CLIENT`, y 409 `CLIENT_EMAIL_TAKEN` si otra persona ya lo usa (sin distinguir mayúsculas);
  - guarde solo los campos cambiados en `Person` y registre la auditoría (`Actualizar`, `Clientes`) con el valor anterior y el nuevo de esos campos;
  - no escriba ni audite cuando nada cambia;
  - traduzca el error `P2002` a 409 `CLIENT_EMAIL_TAKEN`.
- [x] 2.2 Registrar `UpdateClientService` en `vet-manage-api/src/modules/clients/clients.module.ts`.
- [x] 2.3 Exponer `PATCH /clients/:clientId` en `vet-manage-api/src/modules/clients/routes/clients.controller.ts` con `ParseUUIDPipe` y `@RequirePermissions('clients:update')`. Debe responder `success(client, 'Datos actualizados correctamente')`.

## 3. Pruebas de backend

- [x] 3.1 Crear `update-client.service.spec.ts` con:
  - actualización exitosa y cliente inactivo;
  - cédula ignorada y envío sin cambios (sin auditoría);
  - auditoría solo de los campos cambiados;
  - 404, cliente dado de baja, correo de otra persona y correo de un cliente que también es personal;
  - teléfono cambiado conservando el correo de un cliente del personal;
  - traducción de `P2002`.
- [x] 3.2 Ampliar `clients.controller.spec.ts` con la ruta `update` y su permiso `clients:update`.
- [x] 3.3 Crear `vet-manage-api/test/clients/client-update.e2e-spec.ts` con:
  - 200 y respuesta del cliente actualizado;
  - 400 por validación y por UUID mal formado, 404 y 409;
  - 401 sin sesión;
  - 403 con los permisos del Administrador y del Técnico Veterinario tomados de `ROLES`, y 200 con los de Recepcionista, Gerente y Veterinario.

## 4. Frontend: API y reglas

- [x] 4.1 Agregar `UpdateClientInput` y `UpdatedClient` en `vet-manage-frontend/src/modules/clients/types.ts`, y `update(clientId, input)` con `patchJson` en `services/clients-api.ts`, con su prueba en `clients-api.test.ts`.
- [x] 4.2 Agregar `validateClientUpdate`, `buildClientUpdateInput` y la función que indica si el correo está bloqueado (roles distintos de `client`) en `form-rules.ts`. Mapear `CLIENT_EMAIL_LOCKED` y `CLIENT_DEACTIVATED` en `describeApiError`, con pruebas en `form-rules.test.ts`.

## 5. Frontend: modal de edición

- [x] 5.1 Crear `vet-manage-frontend/src/modules/clients/components/client-edit-modal.tsx` con:
  - los datos actuales precargados y la cédula deshabilitada en solo lectura;
  - el correo bloqueado con su aviso cuando corresponde;
  - los campos resaltados y el mensaje general;
  - los botones «Guardar Cambios» y «Cancelar», deshabilitados mientras se guarda.
- [x] 5.2 Actualizar `clients-page.tsx` y `clients-page.css`:
  - columna de acciones con `clients:update` o `clients:inactivate`;
  - botón «Editar» en los clientes que no estén dados de baja;
  - al guardar: cierra el modal, actualiza la fila en memoria y muestra «Datos actualizados correctamente».
- [x] 5.3 Crear `client-edit-modal.test.tsx` y ampliar `clients-page.test.tsx` con:
  - visibilidad de «Editar» según el permiso y el estado;
  - cédula bloqueada y correo bloqueado de un cliente del personal;
  - validación sin llamar a la API y error de correo repetido de la API;
  - guardado exitoso que actualiza la fila y cancelación sin llamar a la API.

## 6. Verificación final

- [x] 6.1 Ejecutar `tsc`, oxlint y las pruebas unitarias del backend y del frontend, y las e2e del backend dentro del contenedor `vet-manage-api-1`.
- [x] 6.2 Probar contra la API real con los usuarios del seed:
  - un cambio de teléfono como Recepcionista;
  - el 403 del Administrador y del Técnico;
  - el correo bloqueado de `gerente.veterinario@vetmanage.local` si es cliente;
  - un correo repetido.
  Revertir los datos de prueba al terminar.
- [x] 6.3 Revisar la pantalla en el navegador: abrir, validar, guardar y cancelar la edición.

## 7. Ajustes de la verificación

- [x] 7.1 Pasar a toasts los mensajes de la edición y de la inactivación (éxito y error), retirar el aviso sobre el listado y agregar la spec modificada `specs/client-inactivation-ui/spec.md`.
- [x] 7.2 Extraer `Field` a `components/client-field.tsx` y usarlo en el registro y en el modal de edición.
- [x] 7.3 Exportar los límites de contacto de HU-01 (`CLIENT_CONTACT_LIMITS`) y usarlos en `client-contact-rules.ts` en lugar de copiarlos.
