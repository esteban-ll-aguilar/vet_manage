## Context

- `User` y `Client` comparten `Person` (`identification` única, `firstName`, `lastName`, `email` único, `phone?`, `address?`), como en el diagrama de clases. El inicio de sesión busca al usuario por `person.email` sin distinguir mayúsculas (`auth.service.ts`).
- `users.controller.ts` ya expone el listado (`users:read`), el registro (`users:create`), la asignación de roles y el cambio de estado. El listado (`UserListItem`) no trae el teléfono.
- El registro de usuarios (HU-51) valida el teléfono con `^\+?\d{7,15}$` y lo trata como opcional. Envía correos con `MailService` y con plantillas que usan `renderEmailLayout`.
- `ChangeUserStatusService` es el modelo a seguir: una transacción, 404 «Usuario no encontrado», rechazo de `DEACTIVATED` y auditoría en el módulo `Usuarios`.
- Según la matriz de roles (sección 2.1), «Actualizar datos de usuario» es solo del Administrador. Este ya tiene `users:update` en `roles.catalog.ts`.

## Goals / Non-Goals

**Goals:**
- Consultar y actualizar nombre, apellido, correo y teléfono de un usuario, con la cédula inmutable y los mensajes de HU-53.
- Permitir el inicio de sesión con el correo nuevo y avisar del cambio al correo anterior.
- Mantener los correos únicos (riesgo R-09) y auditar los cambios.
- Ofrecer la edición desde la pantalla de usuarios y la consulta de solo lectura de los usuarios dados de baja.

**Non-Goals:**
- Cambiar la dirección: no es parte de HU-53, y el registro de usuarios no la pide.
- Cambiar roles, estado o contraseña: son HU-54, HU-55 y HU-60.
- Confirmar el correo nuevo con un enlace, o revertir el cambio desde el aviso.
- Unificar las reglas de validación con HU-01 y HU-02, que usan otro formato de teléfono. Solo se comparte la idea de filtrar lo que se escribe (decisión 12); cada módulo conserva su formato y sus mensajes.

## Decisions

### 1. Un servicio por operación en `identity`
`UserDetailService` (consulta) y `UpdateUserService` (actualización) en `modules/identity/services/`, cada uno con su archivo de pruebas. Las dos rutas van en `users.controller.ts`, con `ParseUUIDPipe` en `:id` para responder 400 sin consultar la base.

### 2. Endpoint de detalle en lugar de ampliar el listado
`GET /users/:id` devuelve el teléfono y los roles vigentes. Se descartó agregar `phone` al listado porque cambia la respuesta de HU-52, que pertenece a otro integrante, y el formulario necesita datos frescos al abrirse.

### 3. Validación propia con los mensajes de los criterios de aceptación
Una función pura `validateUserContact` en `services/user-contact-rules.ts`:
- `"Complete los campos obligatorios"` (`USER_MISSING_FIELDS`) con la lista de los obligatorios vacíos (`firstName`, `lastName`, `email`);
- `"Formato no válido"` para el correo (`USER_INVALID_EMAIL`, `isEmail`, hasta 255), para el teléfono (`USER_INVALID_PHONE`, el mismo patrón de HU-51) y para los nombres de más de 100 caracteres (`USER_INVALID_NAME`, solo con los campos largos).

Normaliza los datos: quita espacios, pasa el correo a minúsculas y guarda el teléfono vacío como `null`. Todos los textos que ve el usuario son los de los criterios de aceptación de HU-53, aunque HU-51 use otros («Ingrese un correo electrónico válido»). Los códigos de error se mantienen.

### 4. Cédula inmutable
El DTO acepta `identification` como opcional solo para que el `ValidationPipe` (`forbidNonWhitelisted`) no responda 400. El servicio nunca la lee.

### 5. Correo único y cambio de correo
- La comparación ignora mayúsculas: `"Carlos@X.com"` y `"carlos@x.com"` son el mismo correo y no cuentan como cambio.
- Antes de guardar, se busca a otra persona con el mismo correo (`mode: 'insensitive'`, `id` distinto) y se responde 409 `USER_EMAIL_TAKEN` con el campo `email`. Un `P2002` de una carrera se traduce al mismo error.
- No se cierran las sesiones abiertas: el token identifica al usuario por su id, no por el correo. El nuevo correo vale desde el siguiente inicio de sesión.
- Si la persona también es cliente, su correo de cliente cambia con ella. Esto es lo esperado: en HU-02, solo el Administrador puede cambiar ese correo.

### 6. Aviso al correo anterior fuera de la transacción
La transacción guarda los datos y la auditoría. Después, si el correo cambió, se envía el aviso (`renderEmailChangedNotice`) al correo anterior.
- La plantilla vive en `modules/identity/templates/email-changed-notice.ts` y reutiliza `renderEmailLayout` y `escapeHtml` sin modificar `infrastructure/`, que es compartido.
- Si el envío falla, se registra en el log. El mensaje sigue siendo `"Datos actualizados correctamente"`, y la respuesta incluye `noticeSent: false` para que la interfaz agregue un toast de advertencia (`"No se pudo enviar el aviso al correo anterior"`).
- Enviarlo dentro de la transacción haría depender el guardado del servidor de correo.

### 7. Estados
- `DEACTIVATED` → 409 `USER_DEACTIVATED`, `"No se puede actualizar un usuario dado de baja"`. La pantalla nunca lo envía, porque muestra la ficha de solo lectura (escenario 8); el mensaje solo protege la API.
- `INACTIVE` se puede editar.
- Usuario inexistente → 404 `"Usuario no encontrado"`.
- El Administrador puede editar sus propios datos.

### 8. Auditoría
Solo de los campos cambiados, en la misma transacción: `AUDIT_ACTIONS.update`, `AUDIT_MODULES.users`, `describePerson`. Sin cambios no hay escritura, auditoría ni aviso.

### 9. Respuesta
`success({ ...user, noticeSent }, message)`. Dentro de `data` van `id`, `personId`, `identification`, `firstName`, `lastName`, `email`, `phone`, `status`, `roles` y `noticeSent` (`true`, `false` o `null` si el correo no cambió). `GET /users/:id` devuelve los mismos datos, sin `noticeSent`.

### 10. Frontend
- `usersApi.get(id)` y `usersApi.update(id, input)`.
- `components/user-field.tsx`: campo (etiqueta, icono, ayuda y error) compartido entre el registro de usuarios (HU-51, `user-register-page.tsx`) y el modal de edición, para no repetirlo.
- `components/user-edit-modal.tsx` tiene dos modos:
  - edición: cédula deshabilitada, «Guardar» y «Cancelar»;
  - consulta (`readOnly`), para los usuarios dados de baja: todos los campos deshabilitados y solo «Cerrar».
- En `users-page.tsx`:
  - «Editar» aparece con `users:update` en usuarios no dados de baja;
  - «Ver datos» aparece en los dados de baja, con `users:read`;
  - al abrir, se consulta el detalle; si falla, se muestra un toast de error.
- Al guardar, se actualiza la fila en memoria y se muestra el toast de éxito `"Datos actualizados correctamente"`. Si `noticeSent === false`, se agrega un toast de advertencia.
- `form-rules.ts`: `validateUserUpdate`, `buildUserUpdateInput` y los nuevos códigos en `describeApiError`.

### 11. Toasts en la pantalla de usuarios
Activar e inactivar (HU-55) también muestran su éxito y su error en toasts. Se retira el aviso sobre el listado, como se hizo con los clientes en HU-02.

### 12. Teléfono solo con números en todos los formularios
- Usuarios (`users/form-rules.ts`): `sanitizePhone` deja dígitos y un `+` inicial, hasta 16 caracteres (`USER_FIELD_LIMITS.phone`). La usan la edición (HU-53) y el registro (HU-51).
- Clientes (`clients/form-rules.ts`): `sanitizePhone` deja solo dígitos y la usan el registro (HU-01) y la edición (HU-02). No recorta la longitud: con 9 u 11 dígitos la validación muestra «Por favor, ingrese un correo y número de teléfono válido», como pide HU-01, en lugar de guardar un número recortado.
- La validación al guardar y la de la API no cambian.

## Risks / Trade-offs

- [Un error de tipeo en el correo nuevo deja al usuario sin acceso] → El aviso llega al correo anterior y la auditoría guarda el valor previo, así que el Administrador puede corregirlo. Una confirmación por enlace queda como mejora.
- [Mensajes de formato distintos entre el registro (HU-51) y la edición (HU-53)] → Se sigue la HU. Se propone al grupo unificar los textos.
- [El aviso puede fallar sin que el usuario se entere] → La interfaz muestra la advertencia al Administrador para que avise por otro medio.
- [Cambiar el correo de quien también es cliente cambia su correo de cliente] → Es la misma persona, como en el diagrama. Queda en la auditoría del módulo `Usuarios`.

## Migration Plan

Sin migraciones ni cambios de permisos. Basta con desplegar el backend y el frontend. Para revertir, se retiran las rutas y los botones.

## Open Questions

- ¿Se unifican los mensajes de formato de HU-51 y HU-53? Requiere acuerdo con el responsable de HU-51.
