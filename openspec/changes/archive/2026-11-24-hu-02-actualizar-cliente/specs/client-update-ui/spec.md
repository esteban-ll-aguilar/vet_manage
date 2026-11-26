## ADDED Requirements

### Requirement: Acción «Editar» en el listado de clientes
La pantalla de clientes SHALL mostrar la acción «Editar» en cada cliente que no esté dado de baja, solo a los usuarios con el permiso `clients:update`.

#### Scenario: Usuario con permiso
- **WHEN** una Recepcionista abre el listado de clientes
- **THEN** cada cliente `ACTIVE` o `INACTIVE` muestra la acción «Editar»

#### Scenario: Cliente dado de baja
- **WHEN** el listado muestra un cliente `DEACTIVATED`
- **THEN** ese cliente no muestra la acción «Editar»

#### Scenario: Usuario sin permiso
- **WHEN** un Técnico Veterinario abre el listado de clientes
- **THEN** no se muestra la acción «Editar» en ningún cliente

### Requirement: Formulario de edición con los datos actuales
Al elegir «Editar», la pantalla SHALL abrir un formulario con los datos actuales del cliente: cédula, primer nombre, primer apellido, correo, teléfono y dirección. La cédula MUST mostrarse deshabilitada y en solo lectura.

#### Scenario: Apertura del formulario
- **WHEN** el usuario elige «Editar» en el cliente «Carlos Pérez»
- **THEN** se abre el formulario con los datos actuales de Carlos
- **AND** el campo de cédula está deshabilitado y no permite cambios

#### Scenario: Correo bloqueado de un cliente que también es personal
- **WHEN** el usuario edita un cliente cuya persona también tiene un rol del personal
- **THEN** el campo de correo se muestra deshabilitado con un aviso de que solo el Administrador puede cambiarlo

### Requirement: Validar el formulario antes de guardar
El formulario SHALL validar en el navegador los mismos campos y mensajes que el registro de clientes antes de llamar a la API, y MUST resaltar cada campo rechazado.

#### Scenario: Campos obligatorios vacíos
- **WHEN** el usuario borra el primer nombre y el teléfono y presiona «Guardar Cambios»
- **THEN** no se llama a la API
- **AND** se resaltan los campos vacíos y se muestra `"Por favor, complete todos los campos obligatorios"`

#### Scenario: Correo o teléfono inválido
- **WHEN** el usuario escribe el correo `"carlos@"` o el teléfono `"0991"` y presiona «Guardar Cambios»
- **THEN** no se llama a la API y se resalta el campo con `"Por favor, ingrese un correo y número de teléfono válido"`

#### Scenario: La API rechaza el correo
- **WHEN** la API responde que el correo ya se encuentra registrado
- **THEN** el formulario sigue abierto, resalta el correo y muestra el mensaje de la API

### Requirement: Guardar y cancelar la edición
Al guardar con éxito, la pantalla SHALL cerrar el formulario, mostrar `"Datos actualizados correctamente"` y reflejar los datos nuevos en el listado sin recargar la página. Al cancelar, MUST cerrar el formulario sin llamar a la API y conservar los datos anteriores.

#### Scenario: Guardado exitoso
- **WHEN** el usuario cambia el teléfono y presiona «Guardar Cambios»
- **THEN** el formulario se cierra, se muestra `"Datos actualizados correctamente"` y el listado muestra los datos nuevos

#### Scenario: Cancelar la edición
- **WHEN** el usuario cambia el teléfono sin guardar y presiona «Cancelar»
- **THEN** el formulario se cierra sin llamar a la API y el listado conserva los datos anteriores

#### Scenario: Guardado en curso
- **WHEN** la API todavía no responde
- **THEN** los botones «Guardar Cambios» y «Cancelar» quedan deshabilitados para evitar un doble envío
