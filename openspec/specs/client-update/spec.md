# client-update Specification

## Purpose

Actualización de los datos de contacto de un cliente en la API (`PATCH /api/v1/clients/:clientId`, HU-02): validación igual al registro, cédula inmutable, correo del personal protegido, rechazo de clientes dados de baja, auditoría y permiso `clients:update`.

## Requirements
### Requirement: Actualizar los datos de contacto de un cliente
El sistema SHALL permitir a un usuario autenticado con el permiso `clients:update` (Recepcionista, Gerente o Veterinario) actualizar el primer nombre, el primer apellido, el correo, el teléfono y la dirección de un cliente mediante `PATCH /api/v1/clients/:clientId`. El sistema MUST guardar los cambios en los datos de la persona del cliente y conservar su estado, sus mascotas y sus historiales clínicos.

#### Scenario: Actualización exitosa de los datos del cliente
- **WHEN** una Recepcionista envía `PATCH /api/v1/clients/:clientId` para un cliente `ACTIVE` con primer nombre, primer apellido, teléfono de 10 dígitos que empieza en `09`, correo válido y dirección
- **THEN** el sistema guarda los datos nuevos
- **AND** responde HTTP `200` con el cliente actualizado (`id`, `identification`, `firstName`, `lastName`, `email`, `phone`, `address`, `status`) y el mensaje `"Datos actualizados correctamente"`

#### Scenario: Actualización de un cliente inactivo
- **WHEN** un usuario autorizado actualiza los datos de un cliente `INACTIVE`
- **THEN** el sistema guarda los datos nuevos y el cliente sigue `INACTIVE`

#### Scenario: Dirección opcional
- **WHEN** un usuario autorizado envía la dirección vacía o sin ella
- **THEN** el sistema guarda el cliente sin dirección

#### Scenario: Envío sin cambios
- **WHEN** un usuario autorizado envía los mismos datos que ya tiene el cliente
- **THEN** el sistema responde HTTP `200` con `"Datos actualizados correctamente"` sin registrar una acción en la auditoría

### Requirement: Mantener la cédula inmutable
El sistema SHALL conservar sin cambios el número de cédula del cliente al actualizarlo; la cédula MUST NOT formar parte de los datos editables.

#### Scenario: Se envía una cédula distinta
- **WHEN** un usuario autorizado envía `PATCH /api/v1/clients/:clientId` con un campo `identification` distinto al registrado
- **THEN** el sistema ignora ese campo, actualiza los demás datos y la cédula del cliente no cambia

### Requirement: Validar los datos del cliente al actualizar
El sistema SHALL aplicar las mismas reglas y mensajes del registro de clientes (HU-01): primer nombre, primer apellido, correo y teléfono son obligatorios; el correo MUST tener formato válido y hasta 255 caracteres; el teléfono MUST tener 10 dígitos y empezar en `09`; los nombres MUST tener hasta 100 caracteres; la dirección MUST tener hasta 255 caracteres. Las respuestas de error MUST indicar los campos rechazados para que el formulario los resalte.

#### Scenario: Campos obligatorios vacíos
- **WHEN** un usuario autorizado envía vacío o ausente uno o más de primer nombre, primer apellido, teléfono o correo
- **THEN** el sistema no actualiza el cliente
- **AND** responde HTTP `400` con `"Por favor, complete todos los campos obligatorios"` y la lista de campos vacíos

#### Scenario: Correo o teléfono con formato inválido
- **WHEN** un usuario autorizado envía el correo `"carlos@"` o el teléfono `"0991"`
- **THEN** el sistema no actualiza el cliente
- **AND** responde HTTP `400` con `"Por favor, ingrese un correo y número de teléfono válido"` indicando el campo rechazado

#### Scenario: Nombres o dirección demasiado largos
- **WHEN** un usuario autorizado envía un nombre o apellido de más de 100 caracteres, o una dirección de más de 255
- **THEN** el sistema responde HTTP `400` con `"Los nombres y apellidos no pueden superar 100 caracteres"` o `"Dirección no válida"` según el campo

#### Scenario: Correo registrado por otra persona
- **WHEN** un usuario autorizado cambia el correo del cliente a uno que ya pertenece a otra persona, sin distinguir mayúsculas
- **THEN** el sistema no actualiza el cliente
- **AND** responde HTTP `409` con `"El correo ya se encuentra registrado"`

### Requirement: Proteger el correo de acceso del personal
El correo del cliente es también el correo con el que su persona inicia sesión. Si la persona tiene asignado un rol vigente que no es de la categoría de cliente (personal o sistema), el sistema MUST NOT cambiar su correo desde la actualización de clientes; solo el Administrador lo cambia desde la gestión de usuarios (HU-53).

#### Scenario: Cambio de correo de un cliente que también es personal
- **WHEN** una Recepcionista envía un correo distinto para un cliente cuya persona también tiene el rol de Gerente
- **THEN** el sistema no actualiza el cliente
- **AND** responde HTTP `409` con `"El correo de este cliente también es el de su cuenta del personal; solo el Administrador puede cambiarlo"` indicando el campo `email`

#### Scenario: Cambio de otros datos de un cliente que también es personal
- **WHEN** un usuario autorizado cambia el teléfono de un cliente que también es personal y envía el mismo correo que ya tiene
- **THEN** el sistema guarda el teléfono nuevo

### Requirement: Rechazar actualizaciones de clientes no disponibles
El sistema SHALL rechazar la actualización cuando el cliente no existe o está dado de baja (`DEACTIVATED`).

#### Scenario: Cliente inexistente
- **WHEN** un usuario autorizado envía `PATCH /api/v1/clients/:clientId` con un UUID que no corresponde a ningún cliente
- **THEN** el sistema responde HTTP `404` con `"Cliente no encontrado"`

#### Scenario: Identificador mal formado
- **WHEN** un usuario autorizado envía `PATCH /api/v1/clients/abc`
- **THEN** el sistema responde HTTP `400` sin consultar la base de datos

#### Scenario: Cliente dado de baja
- **WHEN** un usuario autorizado intenta actualizar un cliente `DEACTIVATED`
- **THEN** el sistema responde HTTP `409` con `"No se puede actualizar un cliente dado de baja"` y no cambia sus datos

### Requirement: Registrar la actualización en la auditoría
El sistema SHALL registrar en la auditoría, dentro de la misma transacción, cada actualización que cambie al menos un dato, con la acción `Actualizar`, el módulo `Clientes`, el registro afectado (cédula y nombre completo), y el valor anterior y el nuevo solo de los campos cambiados. Si la actualización falla, MUST NOT registrarse.

#### Scenario: Auditoría de un cambio de teléfono
- **WHEN** un usuario autorizado cambia el teléfono de `"0991111111"` a `"0992222222"`
- **THEN** la auditoría guarda la acción `Actualizar` del módulo `Clientes` con valor anterior `{ phone: "0991111111" }` y valor nuevo `{ phone: "0992222222" }`

#### Scenario: Actualización rechazada
- **WHEN** la actualización es rechazada por validación o por un correo repetido
- **THEN** no se registra ninguna acción en la auditoría

### Requirement: Proteger el endpoint con clients:update
El sistema SHALL exigir sesión iniciada y el permiso `clients:update` en `PATCH /api/v1/clients/:clientId`.

#### Scenario: Sin sesión
- **WHEN** se envía `PATCH /api/v1/clients/:clientId` sin token de acceso
- **THEN** el sistema responde HTTP `401`

#### Scenario: Usuario sin permiso
- **WHEN** un usuario sin `clients:update` (por ejemplo Administrador, Técnico Veterinario, Cajero o Bodeguero) envía `PATCH /api/v1/clients/:clientId`
- **THEN** el sistema responde HTTP `403` con `"No tiene permisos para realizar esta acción"`

