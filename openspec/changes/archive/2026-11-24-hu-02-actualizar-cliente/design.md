## Context

- Los datos de contacto del cliente (cédula, nombres, apellidos, correo, teléfono y dirección) viven en `Person`; `Client` solo guarda el estado. El diagrama de clases define `Cliente «esUna» Persona` y `Usuario «perteneceA» Persona`: una persona se guarda una sola vez aunque sea cliente y empleado.
- Cada cliente registrado con HU-01 tiene una cuenta de usuario con el rol `client`, y su correo es el de inicio de sesión. Por eso, cambiar el correo de un cliente cambia su correo de acceso.
- Ya existen en el dominio `clients` (`vet-manage-api/src/modules/clients/`):
  - el listado (HU-06), que devuelve `phone`, `address` y los roles vigentes de la persona;
  - la inactivación (HU-04), con `ChangeClientStatusService`, una transacción de Prisma y la auditoría con valor anterior y nuevo (HT-04).
- Las reglas y los mensajes de validación del registro están en `identity/services/client-registration.service.ts` (`CLIENT_MESSAGES` exportado, la validación es privada). Ese módulo es de HU-01.
- Permisos: la matriz (sección 2.2) da «Actualizar cliente» a Gerente, Veterinario y Recepcionista, que ya tienen `clients:update`. El Administrador no lo tiene. No hay que tocar `roles.catalog.ts`.
- Guía de rutas: cada endpoint pide su permiso con `@RequirePermissions`; sin sesión responde 401 y sin permiso 403. En el frontend, el mismo permiso oculta botones con `hasPermission`.
- Convención del grupo para actualizar: `PATCH /<recurso>/:id`, como especies, razas y productos.

## Goals / Non-Goals

**Goals:**
- `PATCH /api/v1/clients/:clientId` con `clients:update` que actualiza nombre, apellido, correo, teléfono y dirección con las reglas de HU-01.
- Cédula inmutable, correo del personal protegido y clientes dados de baja rechazados.
- Auditoría de los campos cambiados en la misma transacción.
- Modal «Editar cliente» en el listado, con la cédula en solo lectura.

**Non-Goals:**
- Avisar por correo del cambio al correo anterior: HU-02 no lo pide (sí lo pide HU-53).
- Cambiar el estado del cliente (HU-04 y HU-05) o darlo de baja (HU-03).
- Editar los datos de usuarios del personal (HU-53).
- Un endpoint de consulta individual: el formulario se llena con los datos que ya trae el listado.

## Decisions

### 1. Servicio propio en el dominio `clients`
Se crea `clients/services/update-client.service.ts` (`UpdateClientService`), siguiendo «un servicio por operación», con la ruta en `clients/routes/clients.controller.ts`. Se registra en `ClientsModule`, que ya importa `AuditModule` e `IdentityModule`.
- *Alternativa:* agregarlo a `ClientRegistrationService` en `identity`. Se descarta porque mezcla dominios y ese archivo es de HU-01.

### 2. Reglas de validación compartidas en `clients`
Se crea `clients/services/client-contact-rules.ts`, una función pura que normaliza (recorta espacios y pasa el correo a minúsculas) y valida nombre, apellido, correo, teléfono y dirección. Lanza `ApiException` con los mensajes de `CLIENT_MESSAGES`, importado de HU-01 para que los textos sean idénticos, y con los campos rechazados.
- No se modifica la validación privada de HU-01 para no tocar su código en este cambio. HU-53 podrá reutilizar esta función.
- *Alternativa:* extraer la validación de HU-01 a `common/`. Implica tocar código compartido y de otro integrante; se deja como mejora posterior.

### 3. Cédula inmutable
El DTO declara `identification` como `@IsOptional()` y el servicio lo ignora. Así, si el frontend la reenvía, el `ValidationPipe` global (`forbidNonWhitelisted`) no responde con un 400 genérico, y la cédula nunca se escribe.
- *Alternativa:* rechazarla con 400. Se descarta porque el formulario muestra la cédula y es fácil que se reenvíe.

### 4. Correo del personal protegido
Si el correo enviado es distinto al actual, el servicio busca los roles vigentes de la persona: rol activo y asignación sin vencer, igual que el listado. Si alguno es de categoría distinta de `CLIENT` (`STAFF` o `SYSTEM`), responde 409 con código `CLIENT_EMAIL_LOCKED` y el campo `email`. Decisión acordada con el responsable de la HU.
- El frontend deshabilita el correo cuando la lista de roles del cliente tiene alguno distinto de `client`. La API es la que protege; el frontend solo evita el intento.
- *Alternativas descartadas:*
  - Permitir siempre el cambio: una Recepcionista podría cambiar el correo de acceso de un Gerente o del Administrador.
  - No editar nunca el correo: contradice el escenario 1 de la HU.

### 5. Correo único sin distinguir mayúsculas
Antes de actualizar se busca otra persona con el mismo correo (`mode: 'insensitive'`, `id` distinto). Además, el error `P2002` de Prisma se traduce a 409 `CLIENT_EMAIL_TAKEN` para cubrir carreras entre dos guardados simultáneos.

### 6. Estado del cliente
- Inexistente: 404 «Cliente no encontrado».
- `DEACTIVATED`: 409 `CLIENT_DEACTIVATED`, «No se puede actualizar un cliente dado de baja» (igual que el escenario 8 de HU-53).
- `INACTIVE`: se permite, porque la HU no lo prohíbe y los datos de contacto pueden necesitarse para reactivarlo.

### 7. Transacción y auditoría
La lectura del cliente, las validaciones contra la base, la actualización de `Person` y `audit.record` van en una sola `prisma.$transaction`. Solo se guardan y auditan los campos que cambian: `previousValue` y `newValue` llevan únicamente esas claves, con la acción `Actualizar`, el módulo `Clientes` y `describePerson` con el nombre nuevo. Si nada cambia, se responde 200 sin escribir ni auditar.

### 8. Respuesta
`200` con `success(client, 'Datos actualizados correctamente')`. `client` lleva `{ id, identification, firstName, lastName, email, phone, address, status }`, para que el frontend actualice la fila sin volver a pedir el listado.

### 9. Frontend: modal en el listado
- `ClientsPage` agrega la columna de acciones también con `clients:update`, y el botón «Editar» en los clientes que no están `DEACTIVATED`.
- Nuevo componente `components/client-edit-modal.tsx` con los campos precargados, la cédula `disabled` y `readOnly`, y los botones «Guardar Cambios» y «Cancelar».
- Validación en `form-rules.ts`: `validateClientUpdate` y `buildClientUpdateInput`, con los mismos mensajes que el registro. Se reutiliza `describeApiError` agregando los códigos nuevos.
- Al guardar: cierra el modal, actualiza la fila en memoria y muestra `"Datos actualizados correctamente"` en un toast (`useToast`), como el registro de clientes. La inactivación (HU-04) también pasa a toasts para su éxito y su error, y se retira el aviso sobre el listado.
- El componente `Field` (etiqueta, icono, ayuda y error) se comparte entre el registro y el modal de edición: `components/client-field.tsx`.
- `clientsApi.update(clientId, input)` usa `patchJson`.

## Risks / Trade-offs

- [Reglas de validación duplicadas con HU-01] → HU-02 importa de HU-01 los mensajes y los límites (`CLIENT_MESSAGES`, `CLIENT_CONTACT_LIMITS`), así que solo se repite el orden de las comprobaciones. Unificar la función completa cambiaría el comportamiento del registro (HU-01, de otro integrante); se propone al grupo después.
- [El frontend decide el bloqueo del correo por el nombre del rol, no por su categoría] → La API es la que bloquea; en el peor caso el usuario recibe el 409 con el mensaje en el campo.
- [Cambiar el correo cambia el correo de inicio de sesión del cliente sin avisarle] → Es lo que pide la HU. Se documenta, y el aviso al correo anterior queda como mejora junto con HU-53.
- [Dos usuarios editan el mismo cliente a la vez] → Gana el último guardado. La auditoría deja ambos cambios; no se agrega control de versión.

## Migration Plan

Sin migraciones ni cambios de permisos. Basta con desplegar el backend y el frontend. Para revertir, se retira la ruta y el botón; los datos guardados siguen siendo válidos.

## Open Questions

- El cambio de la inactivación a toasts toca la interfaz de HU-04: avisar a su responsable.

- ¿Se extrae la validación de contacto a `common/` para que HU-01, HU-02 y HU-53 usen la misma? Requiere acuerdo con el responsable de HU-01.
