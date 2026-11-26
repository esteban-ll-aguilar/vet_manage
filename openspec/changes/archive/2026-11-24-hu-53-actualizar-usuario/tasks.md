## 1. Backend: reglas, DTO y plantilla (`identity`)

- [x] 1.1 Crear `vet-manage-api/src/modules/identity/services/user-contact-rules.ts` con `validateUserContact`, que normalice y valide nombre, apellido, correo y teléfono opcional. Debe usar los mensajes de los criterios de aceptación de HU-53 (`"Complete los campos obligatorios"` y `"Formato no válido"`, también para los nombres largos) y los códigos `USER_MISSING_FIELDS`, `USER_INVALID_EMAIL`, `USER_INVALID_PHONE` y `USER_INVALID_NAME`, con los campos rechazados. Probarla en `user-contact-rules.spec.ts`.
- [x] 1.2 Crear `dtos/update-user.dto.ts` con `firstName`, `lastName`, `email` y `phone` opcionales, e `identification` opcional para que se ignore.
- [x] 1.3 Crear `modules/identity/templates/email-changed-notice.ts` (`renderEmailChangedNotice`), con `renderEmailLayout` y `escapeHtml`, y su prueba.

## 2. Backend: servicios y rutas

- [x] 2.1 Crear `services/user-detail.service.ts` (`UserDetailService.get(id)`): datos de la persona, estado y roles vigentes; 404 `"Usuario no encontrado"`. Probarlo en `user-detail.service.spec.ts`.
- [x] 2.2 Crear `services/update-user.service.ts` (`UpdateUserService.update(id, input, actorId)`):
  - valida antes de abrir la transacción;
  - responde 404, y 409 `USER_DEACTIVATED` si el usuario está dado de baja;
  - con un correo nuevo, responde 409 `USER_EMAIL_TAKEN` si otra persona lo usa (sin distinguir mayúsculas);
  - guarda solo los campos cambiados y audita (`Actualizar`, `Usuarios`), sin escribir cuando nada cambia;
  - traduce `P2002`;
  - después de la transacción, envía el aviso al correo anterior y devuelve `noticeSent`, siempre con el mensaje `"Datos actualizados correctamente"`.
- [x] 2.3 Crear `update-user.service.spec.ts` con:
  - éxito, usuario inactivo, cédula ignorada y teléfono vacío;
  - sin cambios (sin auditoría ni aviso);
  - auditoría solo de los campos cambiados;
  - 404, usuario dado de baja y correo repetido;
  - correo con otras mayúsculas;
  - aviso enviado, aviso fallido y sin aviso cuando el correo no cambia;
  - `P2002`.
- [x] 2.4 Registrar los servicios en `identity.module.ts`. Exponer `GET /users/:id` (`users:read`) y `PATCH /users/:id` (`users:update`) en `users.controller.ts`, con `ParseUUIDPipe`. Ampliar las pruebas del controlador si existen.

## 3. Pruebas e2e del backend

- [x] 3.1 Crear `vet-manage-api/test/identity/user-update.e2e-spec.ts` con:
  - `GET` 200, 404 y 400;
  - `PATCH` 200 con la respuesta, 400 por validación y por UUID mal formado, 404, 409 por usuario dado de baja y por correo repetido;
  - 401 sin sesión;
  - 403 con los permisos de los roles sin `users:update` tomados de `ROLES` (Gerente entre ellos), y 200 con el Administrador.

## 4. Frontend: API y reglas

- [x] 4.1 Agregar `UserDetail`, `UpdateUserInput` y `UpdatedUser` en `vet-manage-frontend/src/modules/users/types.ts`, y `get(id)` y `update(id, input)` en `services/users-api.ts`, con sus pruebas.
- [x] 4.2 Agregar `validateUserUpdate`, `buildUserUpdateInput` y los mensajes de HU-53 en `form-rules.ts`. Mapear `USER_EMAIL_TAKEN`, `USER_INVALID_*` y `USER_DEACTIVATED` en `describeApiError`, con pruebas.

## 5. Frontend: modal y pantalla

- [x] 5.1 Crear `components/user-edit-modal.tsx` y su CSS:
  - modo edición: cédula deshabilitada, campos resaltados, mensaje general, «Guardar» y «Cancelar» deshabilitados mientras guarda;
  - modo consulta: todos los campos deshabilitados y solo «Cerrar».
- [x] 5.2 Actualizar `pages/users-page.tsx`:
  - «Editar» con `users:update` en usuarios no dados de baja, y «Ver datos» en los dados de baja;
  - consulta del detalle al abrir, con un toast de error si falla;
  - al guardar, actualizar la fila y mostrar el toast `"Datos actualizados correctamente"`, más un toast de advertencia si `noticeSent === false`.
- [x] 5.3 Crear `user-edit-modal.test.tsx` y ampliar `users-page.test.tsx` con:
  - visibilidad de las acciones según el permiso y el estado;
  - cédula bloqueada y ficha de solo lectura;
  - validación sin llamar a la API y correo repetido devuelto por la API;
  - guardado con toast de éxito y de advertencia, y cancelación.

## 6. Verificación final

- [x] 6.1 Ejecutar `tsc`, oxlint y las pruebas unitarias del backend y del frontend, y las e2e del backend en el contenedor `vet-manage-api-1`.
- [x] 6.2 Probar contra la API real con los usuarios del seed:
  - cambio de teléfono;
  - cambio de correo e inicio de sesión con el nuevo (y rechazo con el anterior);
  - aviso al correo anterior;
  - correo repetido;
  - usuario dado de baja;
  - 403 del Gerente.
  Revertir los datos de prueba al terminar.
- [x] 6.3 Revisar la pantalla en el navegador: editar, validar, guardar, cancelar y consultar un usuario dado de baja.

## 7. Ajustes posteriores

- [x] 7.1 Mostrar en toasts los mensajes de activar e inactivar (éxito y error), retirar el aviso sobre el listado y agregar la spec modificada `specs/user-status-management-ui/spec.md`.
- [x] 7.2 En el formulario de edición, dejar solo dígitos y un `+` inicial en el teléfono (`sanitizePhone`, hasta 16 caracteres) y tomar los límites de nombre, apellido y correo de `USER_FIELD_LIMITS`, con sus pruebas.
- [x] 7.3 Filtrar el teléfono en los demás formularios: registro de usuarios (`user-register-page.tsx`, conserva el `+`), y registro y edición de clientes (`client-register-page.tsx`, `client-edit-modal.tsx`, con `sanitizePhone` en `clients/form-rules.ts`, sin recortar la longitud). Con pruebas de cada formulario.
