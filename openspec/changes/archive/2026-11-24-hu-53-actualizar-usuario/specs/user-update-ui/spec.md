## ADDED Requirements

### Requirement: Acciones «Editar» y «Ver datos» en el listado de usuarios
La pantalla de usuarios SHALL mostrar la acción «Editar» a quien tenga el permiso `users:update`, en los usuarios `ACTIVE` o `INACTIVE`. En los usuarios `DEACTIVATED` SHALL mostrar en su lugar la acción «Ver datos».

#### Scenario: Administrador en el listado
- **WHEN** el Administrador abre el listado de usuarios
- **THEN** cada usuario activo o inactivo muestra «Editar»
- **AND** cada usuario dado de baja muestra «Ver datos» y no muestra «Editar»

#### Scenario: Usuario sin permiso
- **WHEN** un usuario sin `users:update` ve el listado de usuarios
- **THEN** no se muestra «Editar» en ningún usuario

### Requirement: Formulario de edición con los datos actuales
Al elegir «Editar», la pantalla SHALL consultar los datos del usuario y abrir un formulario precargado con cédula, primer nombre, primer apellido, correo y teléfono. La cédula MUST mostrarse bloqueada, sin permitir cambios.

#### Scenario: Apertura del formulario
- **WHEN** el Administrador elige «Editar» en "Carlos Pérez"
- **THEN** se abre el formulario con los datos actuales de Carlos, incluido su teléfono
- **AND** el campo de cédula está deshabilitado

#### Scenario: Falla la consulta del usuario
- **WHEN** la consulta de los datos del usuario falla
- **THEN** se muestra el error en un toast y no se abre el formulario

### Requirement: Consulta de un usuario dado de baja
Al elegir «Ver datos» en un usuario dado de baja, la pantalla SHALL mostrar sus datos solo para consulta, sin campos editables ni botón «Guardar».

#### Scenario: Ficha de un usuario dado de baja
- **WHEN** el Administrador abre la ficha de "Luis Ríos", que fue dado de baja
- **THEN** ve sus datos con todos los campos deshabilitados
- **AND** solo puede cerrar la ficha

### Requirement: Validar el formulario antes de guardar
El formulario SHALL validar en el navegador los mismos campos y mensajes que la API antes de enviarla, y MUST resaltar cada campo rechazado.

#### Scenario: Nombre vacío
- **WHEN** el Administrador borra el nombre y presiona «Guardar»
- **THEN** no se llama a la API
- **AND** se resalta el nombre y se muestra `"Complete los campos obligatorios"`

#### Scenario: Correo o teléfono inválido
- **WHEN** el Administrador escribe el correo `"carlos@"` o el teléfono `"0991"` y presiona «Guardar»
- **THEN** no se llama a la API
- **AND** el campo se resalta con `"Formato no válido"`

#### Scenario: Teléfono solo con números
- **WHEN** el Administrador escribe letras, espacios o guiones en el teléfono
- **THEN** el campo solo conserva los dígitos y un `+` inicial opcional, hasta 16 caracteres

#### Scenario: Límite de longitud de los campos
- **WHEN** el Administrador escribe más caracteres de los permitidos
- **THEN** el nombre y el apellido no pasan de 100 caracteres y el correo no pasa de 255, los mismos límites que acepta la API

#### Scenario: La API rechaza el correo
- **WHEN** la API responde que el correo ya se encuentra registrado
- **THEN** el formulario sigue abierto, resalta el correo y muestra `"El correo ya se encuentra registrado"`

### Requirement: Guardar y cancelar la edición
Al guardar con éxito, la pantalla SHALL cerrar el formulario, mostrar `"Datos actualizados correctamente"` en un toast y reflejar los datos nuevos en el listado sin recargar la página. Al cancelar, MUST cerrar el formulario sin llamar a la API.

#### Scenario: Guardado exitoso
- **WHEN** el Administrador cambia el teléfono y presiona «Guardar»
- **THEN** el formulario se cierra y un toast de éxito muestra `"Datos actualizados correctamente"`
- **AND** el listado muestra los datos nuevos

#### Scenario: El aviso al correo anterior no se envió
- **WHEN** la API guarda el cambio de correo, pero responde `noticeSent: false`
- **THEN** el formulario se cierra y el toast de éxito muestra `"Datos actualizados correctamente"`
- **AND** un segundo toast de advertencia indica que no se pudo enviar el aviso al correo anterior

#### Scenario: Cancelar la edición
- **WHEN** el Administrador cambia el teléfono sin guardar y presiona «Cancelar»
- **THEN** el formulario se cierra sin llamar a la API y se conservan los datos anteriores

#### Scenario: Guardado en curso
- **WHEN** la API todavía no responde
- **THEN** los botones «Guardar» y «Cancelar» quedan deshabilitados para evitar un doble envío
