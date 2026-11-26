# user-update Specification

## Purpose

Actualización de los datos de contacto de un usuario del personal en la API (`GET` y `PATCH /api/v1/users/:id`, HU-53): validación con los mensajes de los criterios de aceptación, cédula inmutable, correo único sin distinguir mayúsculas, aviso al correo anterior, rechazo de usuarios dados de baja, auditoría y permisos `users:read` y `users:update`.

## Requirements
### Requirement: Consultar los datos de un usuario
El sistema SHALL permitir a un usuario con el permiso `users:read` consultar los datos de un usuario mediante `GET /api/v1/users/:id`. La respuesta MUST incluir `id`, `identification`, `firstName`, `lastName`, `email`, `phone`, `status` y los roles vigentes (`name`, `displayName`).

#### Scenario: Consulta exitosa
- **WHEN** el Administrador envía `GET /api/v1/users/:id` de un usuario existente
- **THEN** el sistema responde HTTP `200` con los datos del usuario, incluido su teléfono

#### Scenario: Usuario inexistente
- **WHEN** el Administrador consulta un UUID que no corresponde a ningún usuario
- **THEN** el sistema responde HTTP `404` con `"Usuario no encontrado"`

#### Scenario: Identificador mal formado
- **WHEN** el Administrador envía `GET /api/v1/users/abc`
- **THEN** el sistema responde HTTP `400` sin consultar la base de datos

### Requirement: Actualizar los datos de contacto de un usuario
El sistema SHALL permitir a un usuario con el permiso `users:update` actualizar el primer nombre, el primer apellido, el correo y el teléfono de un usuario mediante `PATCH /api/v1/users/:id`. Los cambios MUST guardarse en la persona del usuario y conservar su estado, sus roles y su contraseña.

#### Scenario: Actualización exitosa del teléfono
- **WHEN** el Administrador cambia el teléfono de "Carlos Pérez" de `"0991111111"` a `"0992222222"`
- **THEN** el sistema guarda el teléfono nuevo
- **AND** responde HTTP `200` con el usuario actualizado y el mensaje `"Datos actualizados correctamente"`

#### Scenario: Usuario inactivo
- **WHEN** el Administrador actualiza los datos de un usuario `INACTIVE`
- **THEN** el sistema guarda los datos nuevos y el usuario sigue `INACTIVE`

#### Scenario: Teléfono opcional
- **WHEN** el Administrador envía el teléfono vacío
- **THEN** el sistema guarda el usuario sin teléfono

#### Scenario: Envío sin cambios
- **WHEN** el Administrador envía los mismos datos que ya tiene el usuario
- **THEN** el sistema responde HTTP `200` con `"Datos actualizados correctamente"`, sin escribir en la base, sin registrar la auditoría y sin enviar correos

### Requirement: Mantener la cédula inmutable
El sistema SHALL conservar sin cambios la cédula del usuario al actualizarlo; la cédula MUST NOT formar parte de los datos editables.

#### Scenario: Se envía una cédula distinta
- **WHEN** el Administrador envía `PATCH /api/v1/users/:id` con un campo `identification` distinto al registrado
- **THEN** el sistema ignora ese campo, actualiza los demás datos y la cédula no cambia

### Requirement: Validar los datos del usuario al actualizar
El sistema SHALL usar los mensajes de los criterios de aceptación de HU-53. El sistema SHALL exigir primer nombre, primer apellido y correo. El correo MUST tener formato válido y hasta 255 caracteres. El teléfono, si se envía, MUST tener de 7 a 15 dígitos con un `+` inicial opcional, igual que en el registro de usuarios (HU-51). Los nombres MUST tener hasta 100 caracteres. Todo error de formato o de longitud MUST responder con `"Formato no válido"`. Las respuestas de error MUST indicar los campos rechazados.

#### Scenario: Campo obligatorio vacío
- **WHEN** el Administrador borra el nombre y envía la actualización
- **THEN** el sistema no actualiza el usuario
- **AND** responde HTTP `400` con `"Complete los campos obligatorios"` y la lista de campos vacíos

#### Scenario: Correo o teléfono con formato inválido
- **WHEN** el Administrador envía el correo `"carlos@"` o el teléfono `"0991"`
- **THEN** el sistema no actualiza el usuario
- **AND** responde HTTP `400` con `"Formato no válido"` indicando el campo rechazado

#### Scenario: Nombres demasiado largos
- **WHEN** el Administrador envía un nombre o un apellido de más de 100 caracteres
- **THEN** el sistema responde HTTP `400` con `"Formato no válido"` indicando ese campo

#### Scenario: Correo usado por otra persona
- **WHEN** el Administrador asigna a "Carlos Pérez" el correo `"ana@correo.com"`, que pertenece a otro usuario, sin importar las mayúsculas
- **THEN** el sistema no actualiza el usuario
- **AND** responde HTTP `409` con `"El correo ya se encuentra registrado"` indicando el campo `email`

### Requirement: Cambiar el correo de acceso y avisar al correo anterior
Cuando cambia el correo, el usuario SHALL iniciar sesión con el correo nuevo. El sistema SHALL enviar, después de guardar, un aviso del cambio al correo anterior. Si el envío falla, el cambio MUST conservarse; la respuesta MUST mantener el mensaje `"Datos actualizados correctamente"` e indicar la falla con `noticeSent: false`.

#### Scenario: Inicio de sesión con el correo nuevo
- **WHEN** el Administrador cambia el correo de "Carlos Pérez" de `"cperez@correo.com"` a `"carlos.perez@correo.com"`
- **THEN** Carlos inicia sesión con `"carlos.perez@correo.com"` y su contraseña actual
- **AND** ya no puede iniciar sesión con `"cperez@correo.com"`

#### Scenario: Aviso al correo anterior
- **WHEN** el Administrador cambia el correo de un usuario
- **THEN** el sistema envía a `"cperez@correo.com"` un aviso de que el correo de acceso cambió, con el correo nuevo

#### Scenario: Falla el envío del aviso
- **WHEN** el correo cambia, pero el servidor de correo no entrega el aviso
- **THEN** el sistema conserva los datos nuevos
- **AND** responde HTTP `200` con `"Datos actualizados correctamente"` y `noticeSent: false`

#### Scenario: Cambio sin nuevo correo
- **WHEN** el Administrador solo cambia el teléfono
- **THEN** el sistema no envía ningún aviso

### Requirement: Rechazar la actualización de usuarios no disponibles
El sistema SHALL rechazar la actualización cuando el usuario no existe o está dado de baja (`DEACTIVATED`).

#### Scenario: Usuario inexistente
- **WHEN** el Administrador envía `PATCH /api/v1/users/:id` con un UUID que no corresponde a ningún usuario
- **THEN** el sistema responde HTTP `404` con `"Usuario no encontrado"`

#### Scenario: Identificador mal formado
- **WHEN** el Administrador envía `PATCH /api/v1/users/abc`
- **THEN** el sistema responde HTTP `400` sin consultar la base de datos

#### Scenario: Usuario dado de baja
- **WHEN** el Administrador intenta actualizar al usuario "Luis Ríos", que está `DEACTIVATED`
- **THEN** el sistema responde HTTP `409` con `"No se puede actualizar un usuario dado de baja"` y no cambia sus datos

### Requirement: Registrar la actualización en la auditoría
El sistema SHALL registrar en la auditoría, en la misma transacción, cada actualización que cambie al menos un dato. El registro MUST incluir la acción `Actualizar`, el módulo `Usuarios`, el registro afectado (cédula y nombre completo), y el valor anterior y el nuevo solo de los campos cambiados. Una actualización rechazada MUST NOT registrarse.

#### Scenario: Auditoría de un cambio de correo
- **WHEN** el Administrador cambia el correo de `"cperez@correo.com"` a `"carlos.perez@correo.com"`
- **THEN** la auditoría guarda `Actualizar` del módulo `Usuarios` con valor anterior `{ email: "cperez@correo.com" }` y valor nuevo `{ email: "carlos.perez@correo.com" }`

#### Scenario: Actualización rechazada
- **WHEN** la actualización se rechaza por validación, por un correo repetido o porque el usuario está dado de baja
- **THEN** no se registra ninguna acción en la auditoría

### Requirement: Proteger los endpoints con permisos
El sistema SHALL exigir sesión iniciada, el permiso `users:read` en `GET /api/v1/users/:id` y el permiso `users:update` en `PATCH /api/v1/users/:id`.

#### Scenario: Sin sesión
- **WHEN** se envía `GET` o `PATCH /api/v1/users/:id` sin token de acceso
- **THEN** el sistema responde HTTP `401`

#### Scenario: Usuario sin permiso
- **WHEN** un Gerente (sin `users:update`) envía `PATCH /api/v1/users/:id` con los datos de otro usuario
- **THEN** el sistema responde HTTP `403` con `"No tiene permisos para realizar esta acción"`

